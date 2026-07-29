import { useAuthStore } from '@/stores/authStore';

// ============================================================
// useAuth — 认证便捷 Hook
// ============================================================

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);

  const isAuthenticated = !!user;
  const isPremium = profile?.membership_tier === 'premium' || profile?.membership_tier === 'lifetime';
  const isFree = profile?.membership_tier === 'free';
  const displayName = profile?.display_name || user?.email?.split('@')[0] || '用户';

  return {
    user,
    profile,
    isAuthenticated,
    isPremium,
    isFree,
    displayName,
    initialized,
    loading,
    signOut: useAuthStore.getState().signOut,
    updateProfile: useAuthStore.getState().updateProfile,
  };
}
