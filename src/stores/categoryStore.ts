import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Category, CategoryKind } from '@/types';

interface CategoryStore {
  categories: Category[];
  loading: boolean;
  initialized: boolean;
  error: string | null;

  fetchCategories: (force?: boolean) => Promise<void>;
  addCategory: (data: { name: string; type: CategoryKind; icon?: string; color?: string }) => Promise<Category | null>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<{ success: boolean; message: string }>;
  getCategoryById: (id: string) => Category | undefined;
  getExpenseCategories: () => Category[];
  getIncomeCategories: () => Category[];
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],
  loading: false,
  initialized: false,
  error: null,

  fetchCategories: async (force = false) => {
    // 已初始化且非强制刷新，则跳过（避免页面切换时重复触发全局 loading）
    const { initialized, loading } = get();
    if (initialized && !force && !loading) return;

    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('type')
      .order('name');

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    set({ categories: data as Category[], loading: false, initialized: true });
  },

  addCategory: async (data) => {
    const { data: created, error } = await supabase
      .from('categories')
      .insert({
        name: data.name,
        type: data.type,
        icon: data.icon || null,
        color: data.color || null,
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      set({ error: error.message });
      return null;
    }
    set((state) => ({ categories: [...state.categories, created as Category] }));
    return created as Category;
  },

  updateCategory: async (id, data) => {
    const { error } = await supabase
      .from('categories')
      .update(data)
      .eq('id', id);

    if (error) {
      set({ error: error.message });
      return;
    }
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? { ...c, ...data } : c)),
    }));
  },

  deleteCategory: async (id) => {
    const category = get().categories.find((c) => c.id === id);
    if (category?.is_default) {
      return { success: false, message: '系统预置分类不可删除' };
    }

    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id);

    if (count && count > 0) {
      return {
        success: false,
        message: `该分类下有 ${count} 笔交易，不可删除（需先迁移数据）`,
      };
    }

    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      set({ error: error.message });
      return { success: false, message: error.message };
    }

    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));
    return { success: true, message: '删除成功' };
  },

  getCategoryById: (id) => get().categories.find((c) => c.id === id),

  getExpenseCategories: () => get().categories.filter((c) => c.type === 'expense'),

  getIncomeCategories: () => get().categories.filter((c) => c.type === 'income'),
}));
