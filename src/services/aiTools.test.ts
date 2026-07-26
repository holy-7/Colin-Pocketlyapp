/**
 * aiTools.test.ts — Function Calling 工具单元测试
 *
 * Mock Zustand Stores 来测试 6 个 tool 的执行逻辑
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Transaction, Category, Budget } from '@/types';

// ---- 测试数据 ----

const mockCategories: Category[] = [
  { id: 'cat-food', name: '餐饮', type: 'expense', parent_id: null, icon: null, color: '#FF6B6B', is_default: true, created_at: '2026-01-01' },
  { id: 'cat-transport', name: '交通', type: 'expense', parent_id: null, icon: null, color: '#4ECDC4', is_default: true, created_at: '2026-01-01' },
  { id: 'cat-salary', name: '工资', type: 'income', parent_id: null, icon: null, color: '#27AE60', is_default: true, created_at: '2026-01-01' },
];

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id || 't1',
    account_id: 'acc-1',
    category_id: overrides.category_id || 'cat-food',
    amount: overrides.amount ?? 100,
    type: overrides.type || 'expense',
    date: overrides.date || '2026-07-15',
    note: null,
    created_at: '2026-07-15T00:00:00Z',
    updated_at: '2026-07-15T00:00:00Z',
  };
}

// ---- Mock Stores ----

const mockGetTransactionsByDateRange = vi.fn();
const mockGetCategories = vi.fn(() => mockCategories);

let mockBudgets: Budget[] = [];

vi.mock('@/stores/transactionStore', () => ({
  useTransactionStore: {
    getState: () => ({
      getTransactionsByDateRange: mockGetTransactionsByDateRange,
    }),
  },
}));

vi.mock('@/stores/categoryStore', () => ({
  useCategoryStore: {
    getState: () => ({
      categories: mockGetCategories(),
    }),
  },
}));

vi.mock('@/stores/budgetStore', () => ({
  useBudgetStore: {
    getState: () => ({
      budgets: mockBudgets,
      getTotalBudget: () => {
        const total = mockBudgets.find((b) => b.category_id === null);
        return total?.amount || 0;
      },
      getCategoryBudget: (catId: string) => mockBudgets.find((b) => b.category_id === catId),
    }),
  },
}));

// Dynamic import after mocks
const {
  AI_TOOLS,
  getMonthlySummary,
  getCategoryBreakdown,
  getBudgetStatus,
  getDailyTrend,
  getHistoricalAvg,
  getTopSpending,
  executeToolCall,
} = await import('@/services/aiTools');

// ============================================================
// AI_TOOLS schema 定义
// ============================================================
describe('AI_TOOLS schema', () => {
  it('定义了 6 个 tool', () => {
    expect(AI_TOOLS).toHaveLength(6);
  });

  it('每个 tool 有 name 和 input_schema', () => {
    for (const tool of AI_TOOLS) {
      expect(tool.name).toBeTruthy();
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe('object');
    }
  });

  it('tool 名不重复', () => {
    const names = AI_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ============================================================
// getMonthlySummary
// ============================================================
describe('getMonthlySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('返回月度汇总数据（聚合后无单笔明细）', async () => {
    mockGetTransactionsByDateRange.mockResolvedValue([
      makeTxn({ id: '1', type: 'expense', category_id: 'cat-food', amount: 300 }),
      makeTxn({ id: '2', type: 'expense', category_id: 'cat-transport', amount: 100 }),
      makeTxn({ id: '3', type: 'income', category_id: 'cat-salary', amount: 5000 }),
    ]);

    const result = await getMonthlySummary(2026, 7);

    expect(result.totalIncome).toBe(5000);
    expect(result.totalExpense).toBe(400);
    expect(result.balance).toBe(4600);
    expect(result.transactionCount).toBe(3);
    expect(result.byCategory).toHaveLength(2);

    // 验证不含单笔数据
    const json = JSON.stringify(result);
    expect(json).not.toContain('acc-1');
    expect(json).not.toContain('note');
    expect(json).not.toContain('categoryId'); // 内部 ID 不应泄露给 LLM
  });
});

// ============================================================
// getCategoryBreakdown
// ============================================================
describe('getCategoryBreakdown', () => {
  it('返回指定分类的每日趋势', async () => {
    mockGetTransactionsByDateRange.mockResolvedValue([
      makeTxn({ id: '1', category_id: 'cat-food', date: '2026-07-01', amount: 50 }),
      makeTxn({ id: '2', category_id: 'cat-food', date: '2026-07-02', amount: 80 }),
      makeTxn({ id: '3', category_id: 'cat-transport', date: '2026-07-01', amount: 20 }),
    ]);

    const result = await getCategoryBreakdown('餐饮', 2026, 7);

    expect(result.categoryName).toBe('餐饮');
    expect(result.total).toBe(130);
    expect(result.daily).toHaveLength(2);
  });
});

// ============================================================
// getBudgetStatus
// ============================================================
describe('getBudgetStatus', () => {
  beforeEach(() => {
    mockBudgets = [
      { id: 'b1', category_id: null, amount: 3000, period: 'monthly', start_date: '2026-07-01', created_at: '', updated_at: '' },
    ];
  });

  it('返回预算使用情况', async () => {
    mockGetTransactionsByDateRange.mockResolvedValue([
      makeTxn({ id: '1', type: 'expense', category_id: 'cat-food', amount: 1500 }),
      makeTxn({ id: '2', type: 'expense', category_id: 'cat-transport', amount: 500 }),
    ]);

    const result = await getBudgetStatus(2026, 7);

    expect(result.totalBudget).toBe(3000);
    expect(result.spent).toBe(2000);
    expect(result.remaining).toBe(1000);
    expect(result.percent).toBe(67); // Math.round(2000/3000*100)
  });
});

// ============================================================
// getDailyTrend
// ============================================================
describe('getDailyTrend', () => {
  it('返回日期范围内的每日趋势', async () => {
    mockGetTransactionsByDateRange.mockResolvedValue([
      makeTxn({ id: '1', date: '2026-07-01', type: 'expense', amount: 100 }),
      makeTxn({ id: '2', date: '2026-07-01', type: 'income', amount: 200 }),
      makeTxn({ id: '3', date: '2026-07-02', type: 'expense', amount: 50 }),
    ]);

    const result = await getDailyTrend('2026-07-01', '2026-07-02');

    expect(result.from).toBe('2026-07-01');
    expect(result.to).toBe('2026-07-02');
    expect(result.totalExpense).toBe(150);
    expect(result.totalIncome).toBe(200);
    expect(result.daily).toHaveLength(2);
  });
});

// ============================================================
// getTopSpending
// ============================================================
describe('getTopSpending', () => {
  it('返回 Top 消费日和分类', async () => {
    mockGetTransactionsByDateRange.mockResolvedValue([
      makeTxn({ id: '1', date: '2026-07-05', category_id: 'cat-food', amount: 500 }),
      makeTxn({ id: '2', date: '2026-07-10', category_id: 'cat-transport', amount: 300 }),
      makeTxn({ id: '3', date: '2026-07-15', category_id: 'cat-food', amount: 100 }),
    ]);

    const result = await getTopSpending(2026, 7, 2);

    expect(result.topDays).toHaveLength(2);
    expect(result.topDays[0].amount).toBe(500);
    expect(result.topCategories).toHaveLength(2);
  });
});

// ============================================================
// executeToolCall（路由）
// ============================================================
describe('executeToolCall', () => {
  beforeEach(() => {
    mockBudgets = [
      { id: 'b1', category_id: null, amount: 3000, period: 'monthly', start_date: '2026-07-01', created_at: '', updated_at: '' },
    ];
  });

  it('路由到正确的 tool 实现', async () => {
    mockGetTransactionsByDateRange.mockResolvedValue([
      makeTxn({ id: '1', type: 'expense', category_id: 'cat-food', amount: 200 }),
    ]);

    const result = await executeToolCall('get_monthly_summary', { year: 2026, month: 7 });
    const parsed = JSON.parse(result);
    expect(parsed.totalExpense).toBe(200);
  });

  it('未知 tool 返回错误', async () => {
    const result = await executeToolCall('unknown_tool', {});
    expect(JSON.parse(result)).toEqual({ error: 'Unknown tool: unknown_tool' });
  });
});
