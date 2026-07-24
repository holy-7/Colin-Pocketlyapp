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

const { useAccountStore } = await import('./accountStore');
import type { Account } from '@/types';

const mockAccounts: Account[] = [
  { id: 'acc-1', name: '现金', type: '现金', balance: 500, currency: 'CNY', created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'acc-2', name: '银行卡', type: '银行卡', balance: 10000, currency: 'CNY', created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'acc-3', name: '支付宝', type: '支付宝', balance: 2000, currency: 'CNY', created_at: '2026-01-01', updated_at: '2026-01-01' },
];

describe('accountStore — getAccountById', () => {
  beforeEach(() => {
    useAccountStore.setState({ accounts: mockAccounts, error: null });
  });

  it('正常：根据 ID 找到账户', () => {
    const { getAccountById } = useAccountStore.getState();
    const result = getAccountById('acc-1');
    expect(result).toBeDefined();
    expect(result?.name).toBe('现金');
    expect(result?.balance).toBe(500);
  });

  it('正常：查找不存在的 ID 返回 undefined', () => {
    const { getAccountById } = useAccountStore.getState();
    const result = getAccountById('non-existent');
    expect(result).toBeUndefined();
  });

  it('边界：空字符串 ID 返回 undefined', () => {
    const { getAccountById } = useAccountStore.getState();
    const result = getAccountById('');
    expect(result).toBeUndefined();
  });

  it('边界：accounts 为空数组时返回 undefined', () => {
    useAccountStore.setState({ accounts: [] });
    const { getAccountById } = useAccountStore.getState();
    const result = getAccountById('acc-1');
    expect(result).toBeUndefined();
  });
});

describe('accountStore — deleteAccount', () => {
  beforeEach(() => {
    useAccountStore.setState({ accounts: mockAccounts, error: null });
  });

  it('正常：删除成功返回 true 并更新 state', async () => {
    mockFrom.mockReturnValue(createMockChain({ data: null, error: null }));

    const { deleteAccount } = useAccountStore.getState();
    const result = await deleteAccount('acc-1');

    expect(result).toBe(true);
    const { accounts } = useAccountStore.getState();
    expect(accounts).toHaveLength(2);
    expect(accounts.find((a) => a.id === 'acc-1')).toBeUndefined();
  });

  it('异常：删除失败也不阻塞——乐观删除本地数据并离线入队', async () => {
    mockFrom.mockReturnValue(
      createMockChain({ data: null, error: { message: '数据库错误' } }),
    );

    const { deleteAccount } = useAccountStore.getState();
    const result = await deleteAccount('acc-1');

    // 乐观删除：本地总是成功
    expect(result).toBe(true);
    // 本地账户已被移除
    const { accounts } = useAccountStore.getState();
    expect(accounts).toHaveLength(2);
  });
});
