import { useState } from 'react';
import { Modal, Form, Input, Select, ColorPicker, Popconfirm, App } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import MobileHeader from '@/components/MobileHeader';
import { useCategoryStore } from '@/stores/categoryStore';
import { getCategoryIcon } from '@/utils/categoryIcons';
import {
  fetchAllTransactionsForExport,
  exportToExcel,
  exportToPDF,
  exportToCSV,
  exportToJSON,
} from '@/services/exportService';
import type { ExportRow } from '@/services/exportService';
import type { Category, Account } from '@/types';

// ============================================================
// 移动端子页面容器
// ============================================================

export function MobileSettingsSheet({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#F5F5F5',
        overflow: 'hidden',
      }}
    >
      <MobileHeader
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            lineHeight: 1,
          }}
        >
          <svg viewBox="0 0 1024 1024" width={20} height={20} fill="#333">
            <path d="M20.650667 509.5424l283.306666 281.873067a62.532267 62.532267 0 0 0 88.200534 0c24.3712-24.234667 24.3712-63.488 0-87.790934L215.381333 527.735467h746.1888a62.293333 62.293333 0 0 0 62.395734-62.088534c0-34.338133-27.886933-62.122667-62.395734-62.122666H215.4496l176.776533-175.8208a61.952 61.952 0 0 0 0-87.825067 62.395733 62.395733 0 0 0-44.168533-18.2272c-15.9744 0-31.914667 6.075733-44.100267 18.2272l-283.306666 281.9072a61.781333 61.781333 0 0 0 0 87.7568z" />
          </svg>
        </button>
        <span style={{ fontSize: 17, fontWeight: 600, color: '#333' }}>{title}</span>
      </MobileHeader>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', width: '100%', padding: '12px 16px 80px 12px' }}>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// 移动端分类管理（含增删改）
// ============================================================

export function MobileCategoryManager({ categories }: { categories: Category[] }) {
  const { addCategory, updateCategory, deleteCategory } = useCategoryStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateCategory(editing.id, values);
      message.success('分类已更新');
    } else {
      await addCategory(values);
      message.success('分类已添加');
    }
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleDelete = async (id: string) => {
    const result = await deleteCategory(id);
    if (result.success) message.success(result.message);
    else message.warning(result.message);
  };

  const isSystemPreset = (cat: Category) => cat.is_default;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 添加按钮 */}
        <button
          onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}
          style={{
            border: '2px dashed #FFD93D',
            background: '#FFFDE7',
            padding: '14px',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            color: '#F5A623',
            cursor: 'pointer',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          ＋ 添加分类
        </button>

        {/* 分类卡片列表 */}
        {categories.map((cat) => (
          <div
            key={cat.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: 12,
              background: '#fff',
              borderRadius: 12,
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: cat.color ? `${cat.color}20` : '#FFF8E1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                color: cat.color || '#F5A623',
                flexShrink: 0,
              }}
            >
              {getCategoryIcon(cat.name, cat.color || '#F5A623', 22) || cat.name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: '#333', fontWeight: 500 }}>{cat.name}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                <span style={{
                  display: 'inline-block',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 11,
                  background: cat.type === 'expense' ? '#FFF0F0' : '#F0FFF4',
                  color: cat.type === 'expense' ? '#E74C3C' : '#27AE60',
                  marginRight: 6,
                }}>
                  {cat.type === 'expense' ? '支出' : '收入'}
                </span>
                {isSystemPreset(cat) ? '系统预置' : '自定义'}
              </div>
            </div>
            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => { setEditing(cat); form.setFieldsValue(cat); setModalOpen(true); }}
                style={{
                  border: 'none',
                  background: '#f5f5f5',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: 'pointer',
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✎
              </button>
              <Popconfirm
                title={isSystemPreset(cat) ? '系统预置分类不可删除' : '确定删除此分类？'}
                onConfirm={() => handleDelete(cat.id)}
                okText="删除" cancelText="取消"
                disabled={isSystemPreset(cat)}
              >
                <button
                  disabled={isSystemPreset(cat)}
                  style={{
                    border: 'none',
                    background: '#FFF0F0',
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: isSystemPreset(cat) ? 'not-allowed' : 'pointer',
                    color: isSystemPreset(cat) ? '#ccc' : '#E74C3C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isSystemPreset(cat) ? 0.4 : 1,
                  }}
                >
                  ✕
                </button>
              </Popconfirm>
            </div>
          </div>
        ))}
      </div>

      {/* 添加/编辑弹窗 */}
      <Modal
        title={editing ? '编辑分类' : '添加分类'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        destroyOnHidden
        okText="保存"
        cancelText="取消"
        centered
      >
        <Form form={form} layout="vertical" initialValues={{ type: 'expense' }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="如：聚餐、地铁" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={[
              { label: '支出', value: 'expense' },
              { label: '收入', value: 'income' },
            ]} />
          </Form.Item>
          <Form.Item name="color" label="颜色">
            <ColorPicker format="hex" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ============================================================
// 移动端账户列表
// ============================================================

export function MobileAccountList({ accounts }: { accounts: Account[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {accounts.map((acct) => (
        <div
          key={acct.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: 12,
            background: '#fff',
            borderRadius: 12,
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#FFF8E1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: '#F5A623',
            }}
          >
            {acct.name.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: '#333', fontWeight: 500 }}>{acct.name}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{acct.type}</div>
          </div>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>
            ¥{acct.balance.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 移动端数据导出
// ============================================================

export function MobileExportView() {
  const { message } = App.useApp();
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (type: 'xlsx' | 'pdf' | 'csv' | 'json') => {
    setExporting(type);
    try {
      const rows: ExportRow[] = await fetchAllTransactionsForExport();
      switch (type) {
        case 'xlsx': exportToExcel(rows); message.success('Excel 导出成功'); break;
        case 'pdf': exportToPDF(rows); message.success('PDF 导出成功'); break;
        case 'csv': exportToCSV(rows); message.success('CSV 导出成功'); break;
        case 'json': exportToJSON(rows); message.success('JSON 导出成功'); break;
      }
    } catch {
      message.error('导出失败，请稍后重试');
    } finally {
      setExporting(null);
    }
  };

  const btnStyle = (isPrimary?: boolean): React.CSSProperties => ({
    border: 'none',
    background: isPrimary ? '#FFD93D' : '#fff',
    padding: '14px',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    color: '#333',
    cursor: exporting ? 'wait' : 'pointer',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ color: '#666', fontSize: 13, margin: 0 }}>
        导出所有交易明细。支持 Excel (.xlsx)、PDF、CSV 和 JSON 四种格式。
      </p>
      <button onClick={() => handleExport('xlsx')} style={btnStyle(true)} disabled={!!exporting}>
        <DownloadOutlined />
        {exporting === 'xlsx' ? '导出中…' : '导出 Excel (.xlsx)'}
      </button>
      <button onClick={() => handleExport('pdf')} style={btnStyle(false)} disabled={!!exporting}>
        <DownloadOutlined />
        {exporting === 'pdf' ? '导出中…' : '导出 PDF'}
      </button>
      <button onClick={() => handleExport('csv')} style={btnStyle(false)} disabled={!!exporting}>
        <DownloadOutlined />
        {exporting === 'csv' ? '导出中…' : '导出 CSV'}
      </button>
      <button onClick={() => handleExport('json')} style={btnStyle(false)} disabled={!!exporting}>
        <DownloadOutlined />
        {exporting === 'json' ? '导出中…' : '导出 JSON'}
      </button>
    </div>
  );
}
