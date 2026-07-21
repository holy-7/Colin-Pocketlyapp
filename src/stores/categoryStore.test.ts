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

const { useCategoryStore } = await import('./categoryStore');
import type { Category } from '@/types';

const mockCategories: Category[] = [
  { id: 'cat-1', name: '餐饮', type: 'expense', parent_id: null, icon: 'CoffeeOutlined', color: '#FF6B6B', is_default: true, created_at: '2026-01-01' },
  { id: 'cat-2', name: '交通', type: 'expense', parent_id: null, icon: 'CarOutlined', color: '#4ECDC4', is_default: true, created_at: '2026-01-01' },
  { id: 'cat-3', name: '工资', type: 'income', parent_id: null, icon: 'DollarOutlined', color: '#27AE60', is_default: true, created_at: '2026-01-01' },
  { id: 'cat-4', name: '奖金', type: 'income', parent_id: null, icon: 'GiftOutlined', color: '#2ECC71', is_default: true, created_at: '2026-01-01' },
  { id: 'cat-5', name: '自定义', type: 'expense', parent_id: null, icon: null, color: null, is_default: false, created_at: '2026-01-01' },
];

describe('categoryStore — getCategoryById', () => {
  beforeEach(() => {
    useCategoryStore.setState({ categories: mockCategories, error: null });
  });

  it('正常：根据 ID 找到分类', () => {
    const { getCategoryById } = useCategoryStore.getState();
    const result = getCategoryById('cat-1');
    expect(result).toBeDefined();
    expect(result?.name).toBe('餐饮');
  });

  it('正常：查找不存在的 ID 返回 undefined', () => {
    const { getCategoryById } = useCategoryStore.getState();
    const result = getCategoryById('non-existent');
    expect(result).toBeUndefined();
  });

  it('边界：空字符串 ID 返回 undefined', () => {
    const { getCategoryById } = useCategoryStore.getState();
    const result = getCategoryById('');
    expect(result).toBeUndefined();
  });

  it('边界：categories 为空数组时返回 undefined', () => {
    useCategoryStore.setState({ categories: [] });
    const { getCategoryById } = useCategoryStore.getState();
    const result = getCategoryById('cat-1');
    expect(result).toBeUndefined();
  });
});

describe('categoryStore — getExpenseCategories', () => {
  beforeEach(() => {
    useCategoryStore.setState({ categories: mockCategories, error: null });
  });

  it('正常：只返回支出类型分类', () => {
    const { getExpenseCategories } = useCategoryStore.getState();
    const result = getExpenseCategories();
    expect(result).toHaveLength(3);
    result.forEach((c) => {
      expect(c.type).toBe('expense');
    });
    const names = result.map((c) => c.name);
    expect(names).toContain('餐饮');
    expect(names).toContain('交通');
    expect(names).toContain('自定义');
  });

  it('边界：无支出分类时返回空数组', () => {
    useCategoryStore.setState({
      categories: [mockCategories[2], mockCategories[3]], // 仅收入
    });
    const { getExpenseCategories } = useCategoryStore.getState();
    const result = getExpenseCategories();
    expect(result).toHaveLength(0);
  });
});

describe('categoryStore — getIncomeCategories', () => {
  beforeEach(() => {
    useCategoryStore.setState({ categories: mockCategories, error: null });
  });

  it('正常：只返回收入类型分类', () => {
    const { getIncomeCategories } = useCategoryStore.getState();
    const result = getIncomeCategories();
    expect(result).toHaveLength(2);
    result.forEach((c) => {
      expect(c.type).toBe('income');
    });
    const names = result.map((c) => c.name);
    expect(names).toContain('工资');
    expect(names).toContain('奖金');
  });

  it('边界：无收入分类时返回空数组', () => {
    useCategoryStore.setState({
      categories: [mockCategories[0], mockCategories[1]], // 仅支出
    });
    const { getIncomeCategories } = useCategoryStore.getState();
    const result = getIncomeCategories();
    expect(result).toHaveLength(0);
  });
});

describe('categoryStore — deleteCategory', () => {
  beforeEach(() => {
    useCategoryStore.setState({ categories: mockCategories, error: null });
  });

  it('正常：删除自定义分类成功', async () => {
    // supabase 查询返回 count=0（该分类下无交易）
    mockFrom.mockReturnValue(createMockChain({ data: [], error: null, count: 0 }));

    const { deleteCategory } = useCategoryStore.getState();
    const result = await deleteCategory('cat-5');

    expect(result.success).toBe(true);
    expect(result.message).toBe('删除成功');
    const { categories } = useCategoryStore.getState();
    expect(categories).toHaveLength(4);
    expect(categories.find((c) => c.id === 'cat-5')).toBeUndefined();
  });

  it('异常：系统预置分类不可删除', async () => {
    const { deleteCategory } = useCategoryStore.getState();
    const result = await deleteCategory('cat-1'); // is_default: true

    expect(result.success).toBe(false);
    expect(result.message).toBe('系统预置分类不可删除');
    // 分类未被删除
    const { categories } = useCategoryStore.getState();
    expect(categories).toHaveLength(5);
  });

  it('异常：分类下有交易时不可删除', async () => {
    // supabase 查询返回 count=3（有交易）
    mockFrom.mockReturnValue(createMockChain({ data: [], error: null, count: 3 }));

    const { deleteCategory } = useCategoryStore.getState();
    const result = await deleteCategory('cat-5'); // 自定义分类

    expect(result.success).toBe(false);
    expect(result.message).toContain('3 笔交易');
    // 分类未被删除
    const { categories } = useCategoryStore.getState();
    expect(categories).toHaveLength(5);
  });

  it('异常：数据库删除操作失败', async () => {
    // 第一步 count=0（允许删除），第二步 delete 失败
    // 需要用两次不同的返回值
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // select count 查询
        return createMockChain({ data: [], error: null, count: 0 });
      }
      // delete 操作失败
      return createMockChain({
        data: null,
        error: { message: '数据库权限不足' },
      });
    });

    const { deleteCategory } = useCategoryStore.getState();
    const result = await deleteCategory('cat-5');

    expect(result.success).toBe(false);
    expect(result.message).toBe('数据库权限不足');
  });
});
