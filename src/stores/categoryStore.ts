import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { syncManager } from '@/services/syncManager';
import { getCachedRecords, cacheRecords } from '@/db/database';
import { useAuthStore } from '@/stores/authStore';
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
    const { initialized, loading } = get();
    if (initialized && !force && !loading) return;

    set({ loading: true, error: null });

    // 本地缓存优先：先从 IndexedDB 加载（瞬时渲染）
    const userId = useAuthStore.getState().user?.id;
    try {
      const cached = await getCachedRecords<Category>('categories', userId);
      if (cached.length > 0) {
        set({ categories: cached, initialized: true });
      }
    } catch { /* 缓存不可用时忽略 */ }

    // 后台从 Supabase 获取最新数据
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('type')
      .order('name');

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }

    if (data) {
      set({ categories: data as Category[], loading: false, initialized: true });
      // 更新本地缓存
      try {
        await cacheRecords('categories', data as Category[], userId);
      } catch { /* 缓存写入失败不影响功能 */ }
    }
  },

  addCategory: async (data) => {
    const userId = useAuthStore.getState().user?.id;
    const { data: created, error } = await supabase
      .from('categories')
      .insert({
        user_id: userId,
        name: data.name,
        type: data.type,
        icon: data.icon || null,
        color: data.color || null,
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      // 离线降级：通过 SyncManager 入队
      const tempId = crypto.randomUUID();
      set((state) => ({
        categories: [...state.categories, { id: tempId, user_id: userId, ...data, is_default: false, created_at: new Date().toISOString(), parent_id: null } as Category],
      }));
      await syncManager.writeOptimistic('categories', 'INSERT', tempId, {
        id: tempId, user_id: userId, name: data.name, type: data.type,
        icon: data.icon || null, color: data.color || null, is_default: false,
        created_at: new Date().toISOString(),
      });
      return { id: tempId, user_id: userId, ...data, is_default: false } as Category;
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
      // 离线降级
      await syncManager.writeOptimistic('categories', 'UPDATE', id, { id, ...data });
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
      await syncManager.writeOptimistic('categories', 'DELETE', id);
    }

    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));
    return { success: true, message: '删除成功' };
  },

  getCategoryById: (id) => get().categories.find((c) => c.id === id),

  getExpenseCategories: () => get().categories.filter((c) => c.type === 'expense'),

  getIncomeCategories: () => get().categories.filter((c) => c.type === 'income'),
}));
