import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Budget } from '@/types';
import type { Database } from '@/types/database';

type BudgetInsert = Database['public']['Tables']['budgets']['Insert'];

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

/** 解析 Supabase DECIMAL 字段（可能是字符串）为数字 */
function parseAmount(b: Budget): Budget {
  return { ...b, amount: typeof b.amount === 'string' ? parseFloat(b.amount as unknown as string) : b.amount };
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
    set({ budgets: (data as Budget[]).map(parseAmount), loading: false, initialized: true });
  },

  setBudget: async (data) => {
    // 查找是否已存在同 category_id 的预算（用于 upsert 冲突检测）
    const { budgets } = get();
    const existing = budgets.find(
      (b) => (b.category_id ?? undefined) === (data.category_id ?? undefined)
    );

    const payload: BudgetInsert = {
      category_id: data.category_id || null,
      amount: data.amount,
      start_date: data.start_date || new Date().toISOString().slice(0, 10),
    };

    // 如果存在同 category_id 的预算，带上 id 让 upsert 走 UPDATE 而不是 INSERT
    if (existing) {
      payload.id = existing.id;
    }

    const { data: created, error } = await supabase
      .from('budgets')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      set({ error: error.message });
      return;
    }

    const parsed = created ? parseAmount(created as Budget) : null;
    if (!parsed) return;

    set((state) => {
      const idx = state.budgets.findIndex(
        (b) => (b.category_id ?? undefined) === (data.category_id ?? undefined)
      );
      if (idx >= 0) {
        const updated = [...state.budgets];
        updated[idx] = parsed;
        return { budgets: updated };
      }
      return { budgets: [...state.budgets, parsed] };
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
    const budgets = get().budgets;
    // 优先用所有分类预算之和（这才是真实的"总预算"）
    const categoryBudgets = budgets.filter((b) => b.category_id !== null);
    if (categoryBudgets.length > 0) {
      return categoryBudgets.reduce((sum, b) => sum + b.amount, 0);
    }
    // 没有分类预算时，回退到独立总预算行（向后兼容）
    const totalBudget = budgets.find((b) => b.category_id === null);
    return totalBudget?.amount || 0;
  },

  getCategoryBudget: (categoryId) =>
    get().budgets.find((b) => b.category_id === categoryId),
}));
