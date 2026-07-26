/**
 * statistics.ts — 统计计算工具（纯函数，不依赖任何外部状态）
 *
 * 用途：3σ 异常检测 + 趋势预测 + 汇总计算
 * 所有函数均为纯函数，输入数据 → 输出结果，便于单元测试
 */

import type { Transaction, Category } from '@/types';

// ============================================================
// 基础聚合工具
// ============================================================

/** 按分类汇总支出 */
export function aggregateByCategory(
  transactions: Transaction[],
  categories: Category[],
): { categoryId: string; categoryName: string; amount: number; percent: number }[] {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);

  if (totalExpense === 0) return [];

  const map = new Map<string, number>();
  for (const t of expenses) {
    map.set(t.category_id, (map.get(t.category_id) || 0) + t.amount);
  }

  return Array.from(map.entries())
    .map(([categoryId, amount]) => {
      const cat = categories.find((c) => c.id === categoryId);
      return {
        categoryId,
        categoryName: cat?.name || '未知分类',
        amount: Math.round(amount * 100) / 100,
        percent: Math.round((amount / totalExpense) * 10000) / 100,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** 按天汇总 */
export function aggregateByDay(
  transactions: Transaction[],
): { date: string; income: number; expense: number }[] {
  const map = new Map<string, { income: number; expense: number }>();

  for (const t of transactions) {
    const entry = map.get(t.date) || { income: 0, expense: 0 };
    if (t.type === 'income') entry.income += t.amount;
    else entry.expense += t.amount;
    map.set(t.date, entry);
  }

  return Array.from(map.entries())
    .map(([date, { income, expense }]) => ({
      date,
      income: Math.round(income * 100) / 100,
      expense: Math.round(expense * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================
// 统计基础函数
// ============================================================

/** 均值 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** 标准差（总体标准差） */
export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Top N（按金额降序） */
export function topN<T extends { amount: number }>(items: T[], n: number): T[] {
  return [...items].sort((a, b) => b.amount - a.amount).slice(0, n);
}

// ============================================================
// 3σ 异常检测
// ============================================================

export interface AnomalyResult {
  categoryId: string;
  categoryName: string;
  currentAmount: number;
  historicalMean: number;
  historicalStddev: number;
  threshold: number; // mean + 3×stddev
  severity: 'none' | 'warning' | 'critical';
}

/**
 * 对每个分类执行 3σ 异常检测
 * @param currentMonth 当月交易
 * @param historicalMonths 历史月份数组（每月一组交易）
 * @param categories 所有分类
 * @returns 按异常严重程度排序的结果
 */
export function detectAnomalies(
  currentMonth: Transaction[],
  historicalMonths: Transaction[][],
  categories: Category[],
): AnomalyResult[] {
  // 汇总当月每个分类的支出
  const currentByCat = new Map<string, number>();
  for (const t of currentMonth) {
    if (t.type === 'expense') {
      currentByCat.set(t.category_id, (currentByCat.get(t.category_id) || 0) + t.amount);
    }
  }

  // 汇总历史每个月每个分类的支出
  const historyByCat = new Map<string, number[]>();
  for (const month of historicalMonths) {
    const monthlyByCat = new Map<string, number>();
    for (const t of month) {
      if (t.type === 'expense') {
        monthlyByCat.set(t.category_id, (monthlyByCat.get(t.category_id) || 0) + t.amount);
      }
    }
    for (const [catId, amount] of monthlyByCat) {
      const arr = historyByCat.get(catId) || [];
      arr.push(amount);
      historyByCat.set(catId, arr);
    }
  }

  const results: AnomalyResult[] = [];

  for (const [catId, currentAmount] of currentByCat) {
    const historical = historyByCat.get(catId) || [];
    const avg = mean(historical);
    const sd = stddev(historical);
    const threshold = avg + 3 * sd;

    // 至少需要 3 个月历史数据才能做有意义检测
    if (historical.length < 3) continue;

    // 只有当月支出超过历史均值才可能有异常
    if (currentAmount <= avg) continue;

    let severity: AnomalyResult['severity'] = 'none';
    if (currentAmount > avg + 5 * sd) {
      severity = 'critical';
    } else if (currentAmount > threshold) {
      severity = 'warning';
    } else {
      continue; // 不超标的不报告
    }

    const cat = categories.find((c) => c.id === catId);
    results.push({
      categoryId: catId,
      categoryName: cat?.name || '未知分类',
      currentAmount: Math.round(currentAmount * 100) / 100,
      historicalMean: Math.round(avg * 100) / 100,
      historicalStddev: Math.round(sd * 100) / 100,
      threshold: Math.round(threshold * 100) / 100,
      severity,
    });
  }

  return results.sort((a, b) => {
    const order = { critical: 0, warning: 1, none: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// ============================================================
// 趋势预测（线性投影）
// ============================================================

export interface TrendPrediction {
  dailyAvg: number;
  projectedTotal: number;
  budgetAmount: number | null;
  willOverspend: boolean;
  overspendAmount: number;
  confidence: number; // 0-1，越高越可信
  daysOfData: number;
  daysInMonth: number;
}

/**
 * 根据当月前 N 天的数据预测整月支出
 * @param transactions 当月已有的交易（前 N 天）
 * @param budgetAmount 月度预算（null = 无预算）
 * @param daysInMonth 本月总天数
 * @returns 预测结果
 */
export function predictMonthEnd(
  transactions: Transaction[],
  budgetAmount: number | null,
  daysInMonth: number,
): TrendPrediction {
  const expenses = transactions.filter((t) => t.type === 'expense');

  // 按天聚合计
  const dailyTotals = new Map<string, number>();
  for (const t of expenses) {
    dailyTotals.set(t.date, (dailyTotals.get(t.date) || 0) + t.amount);
  }

  const dailyValues = Array.from(dailyTotals.values());
  const daysOfData = dailyTotals.size;

  if (daysOfData === 0) {
    return {
      dailyAvg: 0,
      projectedTotal: 0,
      budgetAmount,
      willOverspend: false,
      overspendAmount: 0,
      confidence: 0,
      daysOfData: 0,
      daysInMonth,
    };
  }

  const dailyAvg = mean(dailyValues);
  const projectedTotal = dailyAvg * daysInMonth;
  const dailyStddev = dailyValues.length >= 2 ? stddev(dailyValues) : 0;

  // 置信度：数据天数占比 × 日支出波动稳定性
  const coverageRatio = daysOfData / daysInMonth;
  const stabilityRatio = dailyAvg > 0 ? 1 - Math.min(dailyStddev / dailyAvg, 0.5) : 0;
  const confidence = Math.round(coverageRatio * stabilityRatio * 100) / 100;

  const willOverspend = budgetAmount !== null && projectedTotal > budgetAmount;
  const overspendAmount = budgetAmount !== null
    ? Math.round((projectedTotal - budgetAmount) * 100) / 100
    : 0;

  return {
    dailyAvg: Math.round(dailyAvg * 100) / 100,
    projectedTotal: Math.round(projectedTotal * 100) / 100,
    budgetAmount,
    willOverspend,
    overspendAmount,
    confidence,
    daysOfData,
    daysInMonth,
  };
}

// ============================================================
// 概要计算
// ============================================================

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
  byCategory: { categoryId: string; categoryName: string; amount: number; percent: number }[];
}

/** 计算月度汇总（纯函数） */
export function computeMonthlySummary(
  transactions: Transaction[],
  categories: Category[],
): MonthlySummary {
  const incomes = transactions.filter((t) => t.type === 'income');
  const expenses = transactions.filter((t) => t.type === 'expense');
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    balance: Math.round((totalIncome - totalExpense) * 100) / 100,
    transactionCount: transactions.length,
    byCategory: aggregateByCategory(transactions, categories),
  };
}
