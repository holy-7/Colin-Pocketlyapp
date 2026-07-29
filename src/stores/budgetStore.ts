import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { syncManager } from '@/services/syncManager';
import { getCachedRecords, cacheRecords } from '@/db/database';
import { useAuthStore } from '@/stores/authStore';
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

    // 本地缓存优先
    const userId = useAuthStore.getState().user?.id;
    try {
      const cached = await getCachedRecords<Budget>('budgets', userId);
      if (cached.length > 0) {
        set({ budgets: cached.map(parseAmount), initialized: true });
      }
    } catch { /* ignore */ }

    const { data, error } = await supabase
      .from('budgets')
      .select('*, category:categories(*)');

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    set({ budgets: (data as Budget[]).map(parseAmount), loading: false, initialized: true });
    try { await cacheRecords('budgets', data as Budget[], userId); } catch { /* ignore */ }
  },

  setBudget: async (data) => {
    const { budgets } = get();
    const existing = budgets.find(
      (b) => (b.category_id ?? undefined) === (data.category_id ?? undefined)
    );

    const userId = useAuthStore.getState().user?.id;
    const payload: BudgetInsert = {
      user_id: userId,
      category_id: data.category_id || null,
      amount: data.amount,
      start_date: data.start_date || new Date().toISOString().slice(0, 10),
    };

    if (existing) {
      payload.id = existing.id;
    }

    const { data: created, error } = await supabase
      .from('budgets')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      // 离线降级
      const tempId = existing?.id || crypto.randomUUID();
      await syncManager.writeOptimistic('budgets', existing ? 'UPDATE' : 'INSERT', tempId, {
        id: tempId, category_id: data.category_id || null,
        amount: data.amount, start_date: data.start_date || new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      });
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
      await syncManager.writeOptimistic('budgets', 'UPDATE', id, { id, amount, updated_at: new Date().toISOString() });
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
      await syncManager.writeOptimistic('budgets', 'DELETE', id);
      set({ error: error.message });
      return;
    }
    set((state) => ({ budgets: state.budgets.filter((b) => b.id !== id) }));
  },

  getTotalBudget: () => {
    const budgets = get().budgets;
    const categoryBudgets = budgets.filter((b) => b.category_id !== null);
    if (categoryBudgets.length > 0) {
      return categoryBudgets.reduce((sum, b) => sum + b.amount, 0);
    }
    const totalBudget = budgets.find((b) => b.category_id === null);
    return totalBudget?.amount || 0;
  },

  getCategoryBudget: (categoryId) =>
    get().budgets.find((b) => b.category_id === categoryId),
}));
