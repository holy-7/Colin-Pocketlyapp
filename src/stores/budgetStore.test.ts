import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock supabase ----
const createMockChain = (resolveValue: any = { data: [], error: null }) => {
  const chain: any = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'then') return (resolve: any) => resolve(resolveValue);
        if (prop === 'catch') return (_reject: any) => {};
        return () => chain;
      },
    },
  );
  return chain;
};

const mockFrom = vi.fn(() => createMockChain());

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
  checkConnection: vi.fn(() => Promise.resolve(true)),
}));

const { useBudgetStore } = await import('./budgetStore');
import type { Budget } from '@/types';

const mockBudgets: Budget[] = [
  { id: 'budget-total', category_id: null, amount: 5000, period: 'monthly', start_date: '2026-01-01', created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'budget-1', category_id: 'cat-1', amount: 1000, period: 'monthly', start_date: '2026-01-01', created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'budget-2', category_id: 'cat-2', amount: 500, period: 'monthly', start_date: '2026-01-01', created_at: '2026-01-01', updated_at: '2026-01-01' },
];

describe('budgetStore — getTotalBudget', () => {
  beforeEach(() => {
    useBudgetStore.setState({ budgets: mockBudgets, error: null });
  });

  it('正常：有分类预算时，getTotalBudget 返回分类预算之和', () => {
    // mockBudgets: cat-1=1000, cat-2=500 → sum=1500, null 行=5000 应被忽略
    const { getTotalBudget } = useBudgetStore.getState();
    expect(getTotalBudget()).toBe(1500);
  });

  it('正常：只有分类预算（无 null 行）时返回分类预算之和', () => {
    useBudgetStore.setState({
      budgets: [mockBudgets[1], mockBudgets[2]], // cat-1=1000, cat-2=500
    });
    const { getTotalBudget } = useBudgetStore.getState();
    expect(getTotalBudget()).toBe(1500);
  });

  it('边界：只有总预算行（category_id=null）无分类预算时，回退到总预算行', () => {
    useBudgetStore.setState({
      budgets: [mockBudgets[0]], // 只有 budget-total (null, 5000)
    });
    const { getTotalBudget } = useBudgetStore.getState();
    expect(getTotalBudget()).toBe(5000);
  });

  it('边界：budgets 为空数组时返回 0', () => {
    useBudgetStore.setState({ budgets: [] });
    const { getTotalBudget } = useBudgetStore.getState();
    expect(getTotalBudget()).toBe(0);
  });
});

describe('budgetStore — getCategoryBudget', () => {
  beforeEach(() => {
    useBudgetStore.setState({ budgets: mockBudgets, error: null });
  });

  it('正常：根据分类 ID 找到对应预算', () => {
    const { getCategoryBudget } = useBudgetStore.getState();
    const result = getCategoryBudget('cat-1');
    expect(result).toBeDefined();
    expect(result?.amount).toBe(1000);
  });

  it('正常：查找不存在的分类 ID 返回 undefined', () => {
    const { getCategoryBudget } = useBudgetStore.getState();
    const result = getCategoryBudget('non-existent-cat');
    expect(result).toBeUndefined();
  });

  it('边界：查找 category_id 为 null 的总预算', () => {
    const { getCategoryBudget } = useBudgetStore.getState();
    const result = getCategoryBudget('');
    expect(result).toBeUndefined();
  });
});

describe('budgetStore — deleteBudget', () => {
  beforeEach(() => {
    useBudgetStore.setState({ budgets: mockBudgets, error: null });
  });

  it('正常：删除预算成功', async () => {
    mockFrom.mockReturnValue(createMockChain({ data: null, error: null }));

    const { deleteBudget } = useBudgetStore.getState();
    await deleteBudget('budget-1');

    const { budgets } = useBudgetStore.getState();
    expect(budgets).toHaveLength(2);
    expect(budgets.find((b) => b.id === 'budget-1')).toBeUndefined();
  });

  it('异常：删除失败时保持原有数据', async () => {
    mockFrom.mockReturnValue(
      createMockChain({ data: null, error: { message: '权限不足' } }),
    );

    const { deleteBudget } = useBudgetStore.getState();
    await deleteBudget('budget-total');

    const { budgets, error } = useBudgetStore.getState();
    expect(error).toBe('权限不足');
    expect(budgets).toHaveLength(3); // 未删除
  });
});
