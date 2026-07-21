import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Account } from '@/types';

interface AccountStore {
  accounts: Account[];
  loading: boolean;
  initialized: boolean;
  error: string | null;

  fetchAccounts: (force?: boolean) => Promise<void>;
  addAccount: (data: { name: string; type: string; balance?: number }) => Promise<void>;
  updateAccount: (id: string, data: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<boolean>;
  getAccountById: (id: string) => Account | undefined;
}

export const useAccountStore = create<AccountStore>((set, get) => ({
  accounts: [],
  loading: false,
  initialized: false,
  error: null,

  fetchAccounts: async (force = false) => {
    const { initialized, loading } = get();
    if (initialized && !force && !loading) return;

    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at');

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    set({ accounts: data as Account[], loading: false, initialized: true });
  },

  addAccount: async (data) => {
    const { data: created, error } = await supabase
      .from('accounts')
      .insert({
        name: data.name,
        type: data.type,
        balance: data.balance ?? 0,
      })
      .select()
      .single();

    if (error) {
      set({ error: error.message });
      return;
    }
    set((state) => ({ accounts: [...state.accounts, created as Account] }));
  },

  updateAccount: async (id, data) => {
    const { error } = await supabase
      .from('accounts')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      set({ error: error.message });
      return;
    }
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...data } : a)),
    }));
  },

  deleteAccount: async (id) => {
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) {
      set({ error: error.message });
      return false;
    }
    set((state) => ({ accounts: state.accounts.filter((a) => a.id !== id) }));
    return true;
  },

  getAccountById: (id) => get().accounts.find((a) => a.id === id),
}));
