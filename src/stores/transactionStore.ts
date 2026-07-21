import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
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

    // eslint-disable-next-line prefer-const
    let query = supabase
      .from('transactions')
      .select('*, account:accounts(*), category:categories(*)', { count: 'exact' });

    // 应用筛选
    if (filter.category_id) query = query.eq('category_id', filter.category_id);
    if (filter.type) query = query.eq('type', filter.type);
    if (filter.date_from) query = query.gte('date', filter.date_from);
    if (filter.date_to) query = query.lte('date', filter.date_to);
    if (filter.amount_min) query = query.gte('amount', filter.amount_min);
    if (filter.amount_max) query = query.lte('amount', filter.amount_max);
    if (filter.keyword) query = query.or(`note.ilike.%${filter.keyword}%`);

    // 分页
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }

    set({
      transactions: data as Transaction[],
      totalCount: count || 0,
      loading: false,
    });
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
      set({ error: error.message });
      return null;
    }

    // 插入标签关联
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
      set({ error: error.message });
      return;
    }

    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === id ? { ...t, ...updates } as Transaction : t)),
    }));
  },

  deleteTransaction: async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      set({ error: error.message });
      return false;
    }
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
      totalCount: Math.max(0, state.totalCount - 1),
    }));
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
      set({ error: error.message });
      return [];
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
      set({ error: error.message });
      return [];
    }
    return data as Transaction[];
  },
}));
