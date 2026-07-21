import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock supabase：使用 Proxy 实现任意链式调用，最终 resolve 指定值 ----
const createMockChain = (resolveValue: any = { data: [], error: null, count: 0 }) => {
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

// 延迟导入，确保 mock 先生效
const { useTransactionStore } = await import('./transactionStore');
import type { TransactionFormData } from '@/types';

describe('transactionStore — setFilter', () => {
  beforeEach(() => {
    useTransactionStore.setState({ filter: {}, error: null });
  });

  it('正常：设置单个筛选条件', () => {
    const { setFilter } = useTransactionStore.getState();
    setFilter({ type: 'expense' });
    const { filter } = useTransactionStore.getState();
    expect(filter.type).toBe('expense');
  });

  it('正常：设置多个筛选条件', () => {
    const { setFilter } = useTransactionStore.getState();
    setFilter({ type: 'expense', category_id: 'cat-1' });
    const { filter } = useTransactionStore.getState();
    expect(filter.type).toBe('expense');
    expect(filter.category_id).toBe('cat-1');
  });

  it('正常：部分更新不会覆盖已有条件', () => {
    useTransactionStore.setState({ filter: { type: 'expense' } });
    const { setFilter } = useTransactionStore.getState();
    setFilter({ category_id: 'cat-2' });
    const { filter } = useTransactionStore.getState();
    expect(filter.type).toBe('expense');
    expect(filter.category_id).toBe('cat-2');
  });

  it('正常：覆盖同名筛选条件', () => {
    useTransactionStore.setState({ filter: { type: 'expense' } });
    const { setFilter } = useTransactionStore.getState();
    setFilter({ type: 'income' });
    const { filter } = useTransactionStore.getState();
    expect(filter.type).toBe('income');
  });

  it('边界：设置空对象不影响已有条件', () => {
    useTransactionStore.setState({ filter: { type: 'expense' } });
    const { setFilter } = useTransactionStore.getState();
    setFilter({});
    const { filter } = useTransactionStore.getState();
    expect(filter.type).toBe('expense');
  });
});

describe('transactionStore — clearFilter', () => {
  beforeEach(() => {
    useTransactionStore.setState({ filter: {}, error: null });
  });

  it('正常：清空所有筛选条件', () => {
    useTransactionStore.setState({
      filter: { type: 'expense', keyword: 'test', category_id: 'cat-1' },
    });
    const { clearFilter } = useTransactionStore.getState();
    clearFilter();
    const { filter } = useTransactionStore.getState();
    expect(filter).toEqual({});
  });
});

describe('transactionStore — addTransaction 金额校验', () => {
  beforeEach(() => {
    useTransactionStore.setState({
      transactions: [],
      loading: false,
      error: null,
      totalCount: 0,
    });
  });

  const baseFormData: TransactionFormData = {
    account_id: 'acc-1',
    category_id: 'cat-1',
    amount: '100',
    type: 'expense',
    date: '2026-01-01',
    note: '',
    tag_ids: [],
  };

  it('正常：有效金额添加成功', async () => {
    mockFrom.mockReturnValue(createMockChain({
      data: {
        id: 'txn-1',
        account_id: 'acc-1',
        category_id: 'cat-1',
        amount: 100,
        type: 'expense',
        date: '2026-01-01',
        note: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    }));

    const { addTransaction } = useTransactionStore.getState();
    const result = await addTransaction({ ...baseFormData });

    expect(result).not.toBeNull();
    expect(result?.amount).toBe(100);

    const { transactions, totalCount } = useTransactionStore.getState();
    expect(transactions).toHaveLength(1);
    expect(totalCount).toBe(1);
  });

  it('异常：金额为 0 返回 null 并设置错误', async () => {
    const { addTransaction } = useTransactionStore.getState();
    const result = await addTransaction({ ...baseFormData, amount: '0' });

    expect(result).toBeNull();
    const { error } = useTransactionStore.getState();
    expect(error).toBe('金额格式错误');
  });

  it('异常：金额为负数返回 null 并设置错误', async () => {
    const { addTransaction } = useTransactionStore.getState();
    const result = await addTransaction({ ...baseFormData, amount: '-100' });

    expect(result).toBeNull();
    const { error } = useTransactionStore.getState();
    expect(error).toBe('金额格式错误');
  });

  it('异常：金额为空字符串返回 null 并设置错误', async () => {
    const { addTransaction } = useTransactionStore.getState();
    const result = await addTransaction({ ...baseFormData, amount: '' });

    expect(result).toBeNull();
    const { error } = useTransactionStore.getState();
    expect(error).toBe('金额格式错误');
  });

  it('异常：金额为非法字符串返回 null 并设置错误', async () => {
    const { addTransaction } = useTransactionStore.getState();
    const result = await addTransaction({ ...baseFormData, amount: 'abc' });

    expect(result).toBeNull();
    const { error } = useTransactionStore.getState();
    expect(error).toBe('金额格式错误');
  });
});

describe('transactionStore — deleteTransaction', () => {
  beforeEach(() => {
    useTransactionStore.setState({
      transactions: [
        { id: 'txn-1', amount: 100, type: 'expense' } as any,
        { id: 'txn-2', amount: 200, type: 'income' } as any,
      ],
      totalCount: 2,
      error: null,
    });
  });

  it('正常：删除成功返回 true 并更新 state', async () => {
    mockFrom.mockReturnValue(createMockChain({ data: null, error: null }));

    const { deleteTransaction } = useTransactionStore.getState();
    const result = await deleteTransaction('txn-1');

    expect(result).toBe(true);
    const { transactions, totalCount } = useTransactionStore.getState();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].id).toBe('txn-2');
    expect(totalCount).toBe(1);
  });

  it('正常：删除最后一条记录 totalCount 为 0', async () => {
    useTransactionStore.setState({
      transactions: [{ id: 'txn-last', amount: 100, type: 'expense' } as any],
      totalCount: 1,
    });
    mockFrom.mockReturnValue(createMockChain({ data: null, error: null }));

    const { deleteTransaction } = useTransactionStore.getState();
    const result = await deleteTransaction('txn-last');

    expect(result).toBe(true);
    const { transactions, totalCount } = useTransactionStore.getState();
    expect(transactions).toHaveLength(0);
    expect(totalCount).toBe(0);
  });

  it('异常：删除失败返回 false 并设置错误', async () => {
    mockFrom.mockReturnValue(
      createMockChain({ data: null, error: { message: '数据库错误' } }),
    );

    const { deleteTransaction } = useTransactionStore.getState();
    const result = await deleteTransaction('txn-1');

    expect(result).toBe(false);
    const { error } = useTransactionStore.getState();
    expect(error).toBe('数据库错误');
  });
});
