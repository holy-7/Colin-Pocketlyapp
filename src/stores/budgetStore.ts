import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Budget } from '@/types';

interface BudgetStore {
  budgets: Budget[];
  loading: boolean;
  initialized: boolean;
  error: string | null;

  fetchBudgets: (force?: boolean) => Promise<void>;
  setBudget: (data: { category_id?: string; amount: number; start_date?: string }) => Promise<void>;
  updateBudget: (id: string, amount: number) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  getTotalBudget: () => number;
  getCategoryBudget: (categoryId: string) => Budget | undefined;
}

export const useBudgetStore = create<BudgetStore>((set, get) => ({
  budgets: [],
  loading: false,
  initialized: false,
  error: null,

  fetchBudgets: async (force = false) => {
    const { initialized, loading } = get();
    if (initialized && !force && !loading) return;

    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('budgets')
      .select('*, category:categories(*)');

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    set({ budgets: data as Budget[], loading: false, initialized: true });
  },

  setBudget: async (data) => {
    const { data: created, error } = await supabase
      .from('budgets')
      .upsert({
        category_id: data.category_id || null,
        amount: data.amount,
        start_date: data.start_date || new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (error) {
      set({ error: error.message });
      return;
    }
    set((state) => {
      const existing = state.budgets.findIndex(
        (b) => b.category_id === data.category_id
      );
      if (existing >= 0) {
        const updated = [...state.budgets];
        updated[existing] = created as Budget;
        return { budgets: updated };
      }
      return { budgets: [...state.budgets, created as Budget] };
    });
  },

  updateBudget: async (id, amount) => {
    const { error } = await supabase
      .from('budgets')
      .update({ amount, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      set({ error: error.message });
      return;
    }
    set((state) => ({
      budgets: state.budgets.map((b) => (b.id === id ? { ...b, amount } : b)),
    }));
  },

  deleteBudget: async (id) => {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) {
      set({ error: error.message });
      return;
    }
    set((state) => ({ budgets: state.budgets.filter((b) => b.id !== id) }));
  },

  getTotalBudget: () => {
    const total = get().budgets.find((b) => b.category_id === null);
    return total?.amount || 0;
  },

  getCategoryBudget: (categoryId) =>
    get().budgets.find((b) => b.category_id === categoryId),
}));
