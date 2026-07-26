/**
 * aiTools.ts — Claude Function Calling 工具定义与实现
 *
 * 每个 tool 的执行流程：
 * 1. 从 Zustand Store / Supabase 查询原始交易数据
 * 2. 在本地做聚合计算（sum / avg / topN 等）
 * 3. 结果过 privacyLayer 脱敏 → 返回给 LLM
 *
 * LLM 永远看不到单笔交易，只能拿到聚合统计。
 */

import { useTransactionStore } from '@/stores/transactionStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useBudgetStore } from '@/stores/budgetStore';
import {
  aggregateByCategory,
  aggregateByDay,
  computeMonthlySummary,
  mean,
  topN,
} from '@/utils/statistics';
import { sanitizeForLLM } from '@/services/privacyLayer';
import type {
  SafeMonthlySummary,
  SafeCategoryAmount,
  SafeDailyTrend,
  SafeBudgetStatus,
  SafeHistoricalAvg,
  SafeTopSpending,
} from '@/services/privacyLayer';

// ============================================================
// Tool JSON Schema 定义（给 Claude API 的 function declarations）
// ============================================================

export const AI_TOOLS = [
  {
    name: 'get_monthly_summary',
    description: '获取指定月份的收支汇总，包括总收入、总支出、结余、交易笔数，以及按分类的支出明细。用于回答"这个月花了多少钱"、"钱花哪了"等问题。',
    input_schema: {
      type: 'object' as const,
      properties: {
        year: { type: 'number', description: '年份，如 2026' },
        month: { type: 'number', description: '月份，1-12' },
      },
      required: ['year', 'month'],
    },
  },
  {
    name: 'get_category_breakdown',
    description: '获取某个分类在指定月份内的每日支出趋势。用于回答"餐饮花了多少"、"交通每天花多少"等问题。',
    input_schema: {
      type: 'object' as const,
      properties: {
        category_name: { type: 'string', description: '分类名称，如"餐饮"、"交通"' },
        year: { type: 'number', description: '年份' },
        month: { type: 'number', description: '月份' },
      },
      required: ['category_name', 'year', 'month'],
    },
  },
  {
    name: 'get_budget_status',
    description: '获取当月预算使用情况，包括总预算、已支出、剩余、百分比，以及每个分类的预算对比。用于回答"预算还剩多少"、"超预算了吗"等问题。',
    input_schema: {
      type: 'object' as const,
      properties: {
        year: { type: 'number', description: '年份' },
        month: { type: 'number', description: '月份' },
      },
      required: ['year', 'month'],
    },
  },
  {
    name: 'get_daily_trend',
    description: '获取指定日期范围内的每日收支趋势。用于分析消费规律、回答"最近花得怎么样"等问题。',
    input_schema: {
      type: 'object' as const,
      properties: {
        from_date: { type: 'string', description: '起始日期，ISO 格式 YYYY-MM-DD' },
        to_date: { type: 'string', description: '结束日期，ISO 格式 YYYY-MM-DD' },
      },
      required: ['from_date', 'to_date'],
    },
  },
  {
    name: 'get_historical_avg',
    description: '获取过去 N 个月的月度支出统计（按月汇总），用于对比和异常检测。回答"跟上个月比怎么样"、"这个月异常吗"等问题。',
    input_schema: {
      type: 'object' as const,
      properties: {
        num_months: { type: 'number', description: '获取最近几个月的统计，如 3 表示过去 3 个月' },
      },
      required: ['num_months'],
    },
  },
  {
    name: 'get_top_spending',
    description: '获取指定月份的 TOP 消费（消费最高的几天 + 支出最多的几个分类）。用于回答"哪天花最多"、"最大开销是什么"等问题。',
    input_schema: {
      type: 'object' as const,
      properties: {
        year: { type: 'number', description: '年份' },
        month: { type: 'number', description: '月份' },
        top_n: { type: 'number', description: '返回前几名，默认 3' },
      },
      required: ['year', 'month'],
    },
  },
];

// ============================================================
// Tool 实现
// ============================================================

/** 月份字符串 YYYY-MM */
function monthStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** 获取某天所在月份的天数 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ---- Tool 1: get_monthly_summary ----
export async function getMonthlySummary(
  year: number,
  month: number,
): Promise<SafeMonthlySummary> {
  const prefix = monthStr(year, month);
  const from = `${prefix}-01`;
  const to = `${prefix}-${String(daysInMonth(year, month)).padStart(2, '0')}`;

  const transactions = await useTransactionStore.getState().getTransactionsByDateRange(from, to);
  const categories = useCategoryStore.getState().categories;

  const summary = computeMonthlySummary(transactions, categories);
  // 去内 部 ID
  const safe = {
    ...summary,
    byCategory: summary.byCategory.map(({ categoryName, amount, percent }) => ({
      categoryName, amount, percent,
    })),
  };
  return sanitizeForLLM(safe, `get_monthly_summary(${year}-${month})`);
}

// ---- Tool 2: get_category_breakdown ----
export async function getCategoryBreakdown(
  categoryName: string,
  year: number,
  month: number,
): Promise<{ categoryName: string; daily: SafeDailyTrend[]; total: number; dailyAvg: number }> {
  const prefix = monthStr(year, month);
  const from = `${prefix}-01`;
  const to = `${prefix}-${String(daysInMonth(year, month)).padStart(2, '0')}`;

  const allTxs = await useTransactionStore.getState().getTransactionsByDateRange(from, to);
  const categories = useCategoryStore.getState().categories;
  const cat = categories.find((c) => c.name === categoryName);

  const filtered = cat
    ? allTxs.filter((t) => t.category_id === cat.id && t.type === 'expense')
    : [];

  const daily = aggregateByDay(filtered).map((d) => ({
    date: d.date,
    income: d.income,
    expense: d.expense,
  }));
  const total = filtered.reduce((s, t) => s + t.amount, 0);
  const days = daily.length || 1;
  const dailyAvg = Math.round((total / days) * 100) / 100;

  const result = { categoryName, daily, total: Math.round(total * 100) / 100, dailyAvg };
  return sanitizeForLLM(result, `get_category_breakdown(${categoryName}, ${year}-${month})`);
}

// ---- Tool 3: get_budget_status ----
export async function getBudgetStatus(
  year: number,
  month: number,
): Promise<SafeBudgetStatus> {
  const prefix = monthStr(year, month);
  const from = `${prefix}-01`;
  const to = `${prefix}-${String(daysInMonth(year, month)).padStart(2, '0')}`;

  const transactions = await useTransactionStore.getState().getTransactionsByDateRange(from, to);
  const categories = useCategoryStore.getState().categories;
  const { budgets, getTotalBudget, getCategoryBudget } = useBudgetStore.getState();

  const expenses = transactions.filter((t) => t.type === 'expense');
  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const totalBudget = getTotalBudget();

  // 分类预算 vs 实际
  const catSpent = new Map<string, number>();
  for (const t of expenses) {
    catSpent.set(t.category_id, (catSpent.get(t.category_id) || 0) + t.amount);
  }

  const byCategory = Array.from(catSpent.entries()).map(([catId, spent]) => {
    const cat = categories.find((c) => c.id === catId);
    const budgetEntry = getCategoryBudget(catId);
    const budget = budgetEntry?.amount || 0;
    return {
      categoryName: cat?.name || '未知',
      budget,
      spent: Math.round(spent * 100) / 100,
      remaining: Math.round((budget - spent) * 100) / 100,
      percent: budget > 0 ? Math.round((spent / budget) * 100) : 0,
    };
  });

  const result: SafeBudgetStatus = {
    totalBudget,
    spent: Math.round(totalSpent * 100) / 100,
    remaining: Math.round((totalBudget - totalSpent) * 100) / 100,
    percent: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
    byCategory,
  };

  return sanitizeForLLM(result, `get_budget_status(${year}-${month})`);
}

// ---- Tool 4: get_daily_trend ----
export async function getDailyTrend(
  fromDate: string,
  toDate: string,
): Promise<{ from: string; to: string; daily: SafeDailyTrend[]; totalIncome: number; totalExpense: number }> {
  const transactions = await useTransactionStore.getState().getTransactionsByDateRange(fromDate, toDate);
  const daily = aggregateByDay(transactions);
  const totalIncome = daily.reduce((s, d) => s + d.income, 0);
  const totalExpense = daily.reduce((s, d) => s + d.expense, 0);

  const result = {
    from: fromDate,
    to: toDate,
    daily,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
  };

  return sanitizeForLLM(result, `get_daily_trend(${fromDate}..${toDate})`);
}

// ---- Tool 5: get_historical_avg ----
export async function getHistoricalAvg(
  numMonths: number,
): Promise<SafeHistoricalAvg[]> {
  const now = new Date();
  const categories = useCategoryStore.getState().categories;
  const results: SafeHistoricalAvg[] = [];

  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const prefix = monthStr(year, month);
    const from = `${prefix}-01`;
    const to = `${prefix}-${String(daysInMonth(year, month)).padStart(2, '0')}`;

    const txs = await useTransactionStore.getState().getTransactionsByDateRange(from, to);
    const expenses = txs.filter((t) => t.type === 'expense');

    // 按分类汇总
    const catMap = new Map<string, number>();
    for (const t of expenses) {
      catMap.set(t.category_id, (catMap.get(t.category_id) || 0) + t.amount);
    }

    const byCategory = Array.from(catMap.entries()).map(([catId, amount]) => {
      const cat = categories.find((c) => c.id === catId);
      return { categoryName: cat?.name || '未知', amount: Math.round(amount * 100) / 100 };
    });

    results.push({
      month: prefix,
      totalExpense: Math.round(expenses.reduce((s, t) => s + t.amount, 0) * 100) / 100,
      byCategory,
    });
  }

  return sanitizeForLLM(results, `get_historical_avg(${numMonths})`);
}

// ---- Tool 6: get_top_spending ----
export async function getTopSpending(
  year: number,
  month: number,
  topNCount: number = 3,
): Promise<SafeTopSpending> {
  const prefix = monthStr(year, month);
  const from = `${prefix}-01`;
  const to = `${prefix}-${String(daysInMonth(year, month)).padStart(2, '0')}`;

  const transactions = await useTransactionStore.getState().getTransactionsByDateRange(from, to);
  const categories = useCategoryStore.getState().categories;
  const expenses = transactions.filter((t) => t.type === 'expense');

  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);

  // 按天 Top
  const dayMap = new Map<string, { amount: number; categoryName: string }>();
  for (const t of expenses) {
    const entry = dayMap.get(t.date);
    if (!entry || t.amount > entry.amount) {
      const cat = categories.find((c) => c.id === t.category_id);
      dayMap.set(t.date, { amount: t.amount, categoryName: cat?.name || '未知' });
    }
  }

  const topDays = topN(
    Array.from(dayMap.entries()).map(([date, v]) => ({
      date,
      amount: v.amount,
      categoryName: v.categoryName,
    })),
    topNCount,
  );

  // 按分类 Top
  const byCat = aggregateByCategory(expenses, categories);
  const topCategories = topN(byCat, topNCount).map((c) => ({
    categoryName: c.categoryName,
    amount: c.amount,
    percent: totalExpense > 0 ? Math.round((c.amount / totalExpense) * 10000) / 100 : 0,
  }));

  const result: SafeTopSpending = { topDays, topCategories };
  return sanitizeForLLM(result, `get_top_spending(${year}-${month}, top${topNCount})`);
}

// ============================================================
// Tool 路由器（将 Claude 返回的 tool_use 路由到正确实现）
// ============================================================

export async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'get_monthly_summary':
      return JSON.stringify(await getMonthlySummary(
        input.year as number,
        input.month as number,
      ));
    case 'get_category_breakdown':
      return JSON.stringify(await getCategoryBreakdown(
        input.category_name as string,
        input.year as number,
        input.month as number,
      ));
    case 'get_budget_status':
      return JSON.stringify(await getBudgetStatus(
        input.year as number,
        input.month as number,
      ));
    case 'get_daily_trend':
      return JSON.stringify(await getDailyTrend(
        input.from_date as string,
        input.to_date as string,
      ));
    case 'get_historical_avg':
      return JSON.stringify(await getHistoricalAvg(
        input.num_months as number,
      ));
    case 'get_top_spending':
      return JSON.stringify(await getTopSpending(
        input.year as number,
        input.month as number,
        (input.top_n as number) || 3,
      ));
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
