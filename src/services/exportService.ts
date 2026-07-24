// ============================================================
// 数据导出服务 — Excel (.xlsx) / PDF / CSV / JSON
// ============================================================
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';
import type { Transaction } from '@/types';

/** HTML 转义，防止 XSS */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---- 导出数据行类型 ----
export interface ExportRow {
  date: string;
  type: 'income' | 'expense';
  typeLabel: string;
  category: string;
  amount: number;
  account: string;
  note: string;
}

// ---- 工具：触发下载 ----
export function downloadFile(content: BlobPart, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- 获取全部交易数据 ----
export async function fetchAllTransactionsForExport(): Promise<ExportRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, account:accounts(name), category:categories(name)')
    .order('date', { ascending: false });

  if (error) throw new Error('获取交易数据失败');

  return ((data || []) as Transaction[]).map((t) => ({
    date: t.date,
    type: t.type,
    typeLabel: t.type === 'expense' ? '支出' : '收入',
    category: t.category?.name || '',
    amount: t.amount,
    account: t.account?.name || '',
    note: t.note || '',
  }));
}

/** 获取当前日期的文件名后缀 */
function dateTag(): string {
  return new Date().toISOString().slice(0, 10);
}

// ============================================================
// Excel 导出
// ============================================================

export function exportToExcel(rows: ExportRow[]): void {
  // ---- Sheet 1: 交易明细 ----
  const detailData = rows.map((r) => ({
    日期: r.date,
    类型: r.typeLabel,
    分类: r.category,
    金额: r.type === 'expense' ? -r.amount : r.amount,
    账户: r.account,
    备注: r.note,
  }));

  const ws1 = XLSX.utils.json_to_sheet(detailData);

  // 设置列宽
  ws1['!cols'] = [
    { wch: 12 }, // 日期
    { wch: 6 },  // 类型
    { wch: 10 }, // 分类
    { wch: 12 }, // 金额
    { wch: 12 }, // 账户
    { wch: 24 }, // 备注
  ];

  // ---- Sheet 2: 分类汇总 ----
  const categoryMap = new Map<string, { income: number; expense: number }>();
  for (const r of rows) {
    const key = r.category || '未分类';
    if (!categoryMap.has(key)) categoryMap.set(key, { income: 0, expense: 0 });
    const agg = categoryMap.get(key)!;
    if (r.type === 'income') agg.income += r.amount;
    else agg.expense += r.amount;
  }

  const summaryData = Array.from(categoryMap.entries()).map(([name, v]) => ({
    分类: name,
    收入: v.income,
    支出: v.expense,
    净额: v.income - v.expense,
  }));

  // 按支出降序排列
  summaryData.sort((a, b) => b.支出 - a.支出);

  const ws2 = XLSX.utils.json_to_sheet(summaryData);
  ws2['!cols'] = [
    { wch: 14 }, // 分类
    { wch: 14 }, // 收入
    { wch: 14 }, // 支出
    { wch: 14 }, // 净额
  ];

  // 创建工作簿并添加两个 sheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, '交易明细');
  XLSX.utils.book_append_sheet(wb, ws2, '分类汇总');

  // 生成 buffer 并下载
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadFile(
    new Uint8Array(buffer),
    `Colin记账-${dateTag()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}

// ============================================================
// PDF 导出（Canvas 2D 手动绘制 → 浏览器原生中文渲染）
// ============================================================

/** 画布绘制配置 */
const PDF_DPI = 1.5;                     // 1.5x 高清（平衡质量与文件大小）
const PDF_MM_PER_PX = 25.4 / 96;         // CSS px → mm (96 DPI)
const PDF_PAGE_W_MM = 297;               // A4 横版宽
const PDF_PAGE_H_MM = 210;               // A4 横版高
const PDF_MARGIN_MM = 8;                 // 页边距
const PDF_USABLE_W = PDF_PAGE_W_MM - PDF_MARGIN_MM * 2;
const PDF_USABLE_H = PDF_PAGE_H_MM - PDF_MARGIN_MM * 2;
const PDF_W_PX = Math.round(PDF_USABLE_W / PDF_MM_PER_PX);
const PDF_H_PX = Math.round(PDF_USABLE_H / PDF_MM_PER_PX);

const COL_W = [120, 50, 120, 100, 100, PDF_W_PX - 490]; // 6 列宽度
const ROW_H = 20;
const HEADER_H = 24;
const FONT = '14px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
const FONT_SM = '11px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';

/** 在 canvas 上绘制文本（支持省略号截断） */
function drawCell(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  fontSize: string,
  color: string,
  align: 'left' | 'center' | 'right',
): void {
  ctx.font = fontSize;
  ctx.fillStyle = color;
  ctx.textAlign = align;

  let display = text;
  while (ctx.measureText(display).width > maxW - 8 && display.length > 0) {
    display = display.slice(0, -1);
  }
  if (display !== text) display += '…';

  const textX = align === 'right' ? x + maxW - 4 : align === 'center' ? x + maxW / 2 : x + 4;
  ctx.fillText(display, textX, y + 4);
}

/** 获取表体字号 */
function bodyFont(bold?: boolean): string {
  return `${bold ? 'bold ' : ''}13px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif`;
}

export function exportToPDF(rows: ExportRow[]): void {
  if (rows.length === 0) {
    // 无数据提示
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.text('Colin记账 — 交易明细', PDF_PAGE_W_MM / 2, PDF_PAGE_H_MM / 2 - 5, { align: 'center' });
    doc.setFontSize(12);
    doc.text('暂无交易记录', PDF_PAGE_W_MM / 2, PDF_PAGE_H_MM / 2 + 5, { align: 'center' });
    doc.save(`Colin记账-${dateTag()}.pdf`);
    return;
  }

  const totalIncome = rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // 预计算：total height needed → 决定每页放多少行
  const titleH = 48;  // 标题 + 摘要
  const usableRowH = PDF_H_PX - titleH - HEADER_H;
  const rowsPerPage = Math.floor(usableRowH / ROW_H);
  const pageCount = Math.ceil(rows.length / rowsPerPage);

  for (let page = 0; page < pageCount; page++) {
    if (page > 0) doc.addPage();

    const canvas = document.createElement('canvas');
    canvas.width = PDF_W_PX * PDF_DPI;
    canvas.height = PDF_H_PX * PDF_DPI;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(PDF_DPI, PDF_DPI);

    // 白底
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PDF_W_PX, PDF_H_PX);

    let y = 0;

    // ---- 标题 ----
    ctx.font = `bold 16px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif`;
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText('Colin记账 — 交易明细', PDF_W_PX / 2, y + 18);
    y += 24;

    // ---- 摘要行 ----
    ctx.font = FONT_SM;
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.fillText(
      `导出日期：${dateTag()}  |  共 ${rows.length} 条  |  收入 ¥${totalIncome.toFixed(2)}  |  支出 ¥${totalExpense.toFixed(2)}`,
      PDF_W_PX / 2,
      y + 16,
    );
    y = titleH;

    // ---- 表头 ----
    const headLabels = ['日期', '类型', '分类', '金额', '账户', '备注'];
    const headAligns: Array<'left' | 'center' | 'right'> = ['left', 'center', 'left', 'right', 'left', 'left'];
    ctx.fillStyle = '#FFD93D';
    ctx.fillRect(0, y, PDF_W_PX, HEADER_H);

    let cx = 0;
    for (let c = 0; c < COL_W.length; c++) {
      drawCell(ctx, headLabels[c], cx, y, COL_W[c], bodyFont(true), '#333', headAligns[c]);
      cx += COL_W[c];
    }
    // 表头底线
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y + HEADER_H);
    ctx.lineTo(PDF_W_PX, y + HEADER_H);
    ctx.stroke();
    y += HEADER_H;

    // ---- 数据行 ----
    const startRow = page * rowsPerPage;
    const endRow = Math.min(startRow + rowsPerPage, rows.length);

    for (let i = startRow; i < endRow; i++) {
      const r = rows[i];
      const bg = r.type === 'expense' ? '#fff0f0' : '#f0fff0';
      ctx.fillStyle = bg;
      ctx.fillRect(0, y, PDF_W_PX, ROW_H);

      const cols = [
        r.date,
        r.typeLabel,
        r.category || '—',
        (r.type === 'expense' ? '-' : '') + r.amount.toFixed(2),
        r.account || '—',
        r.note || '',
      ];
      const colors = [
        '#333',
        r.type === 'expense' ? '#e74c3c' : '#27ae60',
        '#333',
        r.type === 'expense' ? '#e74c3c' : '#27ae60',
        '#333',
        '#666',
      ];

      cx = 0;
      for (let c = 0; c < COL_W.length; c++) {
        drawCell(ctx, cols[c], cx, y, COL_W[c], bodyFont(), colors[c], headAligns[c]);
        cx += COL_W[c];
      }

      // 行底部分隔线
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(0, y + ROW_H);
      ctx.lineTo(PDF_W_PX, y + ROW_H);
      ctx.stroke();

      y += ROW_H;
    }

    // 页脚
    ctx.font = FONT_SM;
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText(`第 ${page + 1} / ${pageCount} 页`, PDF_W_PX / 2, PDF_H_PX - 6);

    // 添加本页到 PDF（JPEG 压缩，大幅减小文件体积）
    const imgData = canvas.toDataURL('image/jpeg', 0.85);
    doc.addImage(imgData, 'JPEG', PDF_MARGIN_MM, PDF_MARGIN_MM, PDF_USABLE_W, PDF_USABLE_H);
  }

  doc.save(`Colin记账-${dateTag()}.pdf`);
}

// ============================================================
// CSV 导出（带 BOM，中文兼容 Excel）
// ============================================================

/**
 * 转义 CSV 单元格值
 * - 包含逗号/引号/换行 → 用双引号包裹并转义内部引号
 * - 以 = + - @ 开头 → 前缀单引号防止 Excel 公式注入 (CSV Injection)
 */
function escapeCSVCell(value: string): string {
  let escaped = value;
  // 防止 CSV 公式注入：Excel 会将 = + - @ 开头的单元格解释为公式
  if (/^[=+\-@]/.test(escaped)) {
    escaped = `'${escaped}`;
  }
  // 标准 CSV 转义
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') || escaped.includes('\r')) {
    escaped = `"${escaped.replace(/"/g, '""')}"`;
  }
  return escaped;
}

export function exportToCSV(rows: ExportRow[]): void {
  const BOM = '﻿';
  const headers = ['日期', '类型', '分类', '金额', '账户', '备注'];
  const csvRows = rows.map((r) => [
    escapeCSVCell(r.date),
    escapeCSVCell(r.typeLabel),
    escapeCSVCell(r.category),
    escapeCSVCell((r.type === 'expense' ? -r.amount : r.amount).toFixed(2)),
    escapeCSVCell(r.account),
    escapeCSVCell(r.note),
  ]);

  const csv = BOM + [headers, ...csvRows].map((row) => row.join(',')).join('\n');
  downloadFile(csv, `Colin记账-${dateTag()}.csv`, 'text/csv;charset=utf-8');
}

// ============================================================
// JSON 导出
// ============================================================

export function exportToJSON(rows: ExportRow[]): void {
  const json = JSON.stringify(rows, null, 2);
  downloadFile(json, `Colin记账-${dateTag()}.json`, 'application/json');
}
