import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { syncManager } from '@/services/syncManager';
import { getCachedRecords, cacheRecords, cacheRecord, removeCachedRecord } from '@/db/database';
import type { Transaction, TransactionFormData, TransactionFilter } from '@/types';
import type { Database } from '@/types/database';

type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];

interface TransactionStore {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  filter: TransactionFilter;
  totalCount: number;

  setFilter: (filter: Partial<TransactionFilter>) => void;
  clearFilter: () => void;
  fetchTransactions: (page?: number, pageSize?: number) => Promise<void>;
  addTransaction: (data: TransactionFormData) => Promise<Transaction | null>;
  updateTransaction: (id: string, data: Partial<TransactionFormData>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<boolean>;
  getTransactionsByMonth: (year: number, month: number) => Promise<Transaction[]>;
  getTransactionsByDateRange: (from: string, to: string) => Promise<Transaction[]>;
}

export const useTransactionStore = create<TransactionStore>((set) => ({
  transactions: [],
  loading: false,
  error: null,
  filter: {},
  totalCount: 0,

  setFilter: (newFilter) =>
    set((state) => ({ filter: { ...state.filter, ...newFilter } })),

  clearFilter: () => set({ filter: {} }),

  fetchTransactions: async (page = 1, pageSize = 20) => {
    set({ loading: true, error: null });
    const filter = useTransactionStore.getState().filter;

    // 尝试从本地缓存加载（瞬时渲染）
    if (page === 1) {
      try {
        const cached = await getCachedRecords<Transaction>('transactions');
        if (cached.length > 0) {
          // 应用基本筛选
          let filtered = cached;
          if (filter.type) filtered = filtered.filter((t) => t.type === filter.type);
          if (filter.category_id) filtered = filtered.filter((t) => t.category_id === filter.category_id);
          if (filter.date_from) filtered = filtered.filter((t) => t.date >= filter.date_from!);
          if (filter.date_to) filtered = filtered.filter((t) => t.date <= filter.date_to!);
          if (filter.keyword) {
            const kw = filter.keyword.toLowerCase();
            filtered = filtered.filter((t) => (t.note || '').toLowerCase().includes(kw));
          }
          // 按日期排序
          filtered.sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || ''));
          const paged = filtered.slice(0, pageSize);
          set({ transactions: paged, totalCount: filtered.length });
        }
      } catch { /* ignore */ }
    }

    // 从 Supabase 获取最新数据
    // eslint-disable-next-line prefer-const
    let query = supabase
      .from('transactions')
      .select('*, account:accounts(*), category:categories(*)', { count: 'exact' });

    if (filter.category_id) query = query.eq('category_id', filter.category_id);
    if (filter.type) query = query.eq('type', filter.type);
    if (filter.date_from) query = query.gte('date', filter.date_from);
    if (filter.date_to) query = query.lte('date', filter.date_to);
    if (filter.amount_min) query = query.gte('amount', filter.amount_min);
    if (filter.amount_max) query = query.lte('amount', filter.amount_max);
    if (filter.keyword) query = query.or(`note.ilike.%${filter.keyword}%`);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      // 离线时保留缓存数据（如果还没有数据才报错）
      const current = useTransactionStore.getState().transactions;
      if (current.length === 0) {
        set({ error: error.message, loading: false });
      } else {
        set({ loading: false });
      }
      return;
    }

    set({
      transactions: data as Transaction[],
      totalCount: count || 0,
      loading: false,
    });

    // 更新本地缓存（后台操作，不阻塞 UI）
    if (data && page === 1) {
      try { await cacheRecords('transactions', data as Transaction[]); } catch { /* ignore */ }
    }
  },

  addTransaction: async (formData) => {
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      set({ error: '金额格式错误' });
      return null;
    }

    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert({
        account_id: formData.account_id,
        category_id: formData.category_id,
        amount,
        type: formData.type,
        date: formData.date,
        note: formData.note || null,
      })
      .select('*, account:accounts(*), category:categories(*)')
      .single();

    if (error) {
      // 离线降级：本地生成临时交易
      const tempId = crypto.randomUUID();
      const tempTx: Transaction = {
        id: tempId,
        account_id: formData.account_id,
        category_id: formData.category_id,
        amount,
        type: formData.type,
        date: formData.date,
        note: formData.note || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      set((state) => ({
        transactions: [tempTx, ...state.transactions],
        totalCount: state.totalCount + 1,
      }));
      await syncManager.writeOptimistic('transactions', 'INSERT', tempId, {
        id: tempId,
        account_id: formData.account_id,
        category_id: formData.category_id,
        amount,
        type: formData.type,
        date: formData.date,
        note: formData.note || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return tempTx;
    }

    // 标签关联
    if (formData.tag_ids.length > 0) {
      const tagRows = formData.tag_ids.map((tag_id) => ({
        transaction_id: (transaction as Transaction).id,
        tag_id,
      }));
      await supabase.from('transaction_tags').insert(tagRows);
    }

    set((state) => ({
      transactions: [transaction as Transaction, ...state.transactions],
      totalCount: state.totalCount + 1,
    }));

    // 更新缓存
    try { await cacheRecord('transactions', transaction as Transaction); } catch { /* ignore */ }
    return transaction as Transaction;
  },

  updateTransaction: async (id, formData) => {
    const updates: TransactionUpdate = {};
    if (formData.account_id) updates.account_id = formData.account_id;
    if (formData.category_id) updates.category_id = formData.category_id;
    if (formData.amount) updates.amount = parseFloat(formData.amount);
    if (formData.type) updates.type = formData.type;
    if (formData.date) updates.date = formData.date;
    if (formData.note !== undefined) updates.note = formData.note || null;
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id);

    if (error) {
      await syncManager.writeOptimistic('transactions', 'UPDATE', id, { id, ...updates });
    }

    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === id ? { ...t, ...updates } as Transaction : t)),
    }));
  },

  deleteTransaction: async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      await syncManager.writeOptimistic('transactions', 'DELETE', id);
    }
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
      totalCount: Math.max(0, state.totalCount - 1),
    }));
    try { await removeCachedRecord('transactions', id); } catch { /* ignore */ }
    return true;
  },

  getTransactionsByMonth: async (year, month) => {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to = `${year}-${String(month).padStart(2, '0')}-31`;

    const { data, error } = await supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false });

    if (error) {
      // 离线降级：从缓存筛选
      try {
        const cached = await getCachedRecords<Transaction>('transactions');
        return cached.filter((t) => t.date >= from && t.date <= to);
      } catch {
        set({ error: error.message });
        return [];
      }
    }
    return data as Transaction[];
  },

  getTransactionsByDateRange: async (from, to) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false });

    if (error) {
      // 离线降级：从缓存筛选
      try {
        const cached = await getCachedRecords<Transaction>('transactions');
        return cached.filter((t) => t.date >= from && t.date <= to);
      } catch {
        set({ error: error.message });
        return [];
      }
    }
    return data as Transaction[];
  },
}));
