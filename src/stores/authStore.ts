import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { clearAllCache } from '@/db/database';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile, MembershipTier } from '@/types';

// ============================================================
// AuthStore — 认证状态管理
// ============================================================

interface AuthState {
  // --- 状态 ---
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;       // 初始化加载中
  initialized: boolean;   // 初始化完成

  // --- 认证操作 ---
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string; needVerification?: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error?: string }>;

  // --- 邮箱验证 ---
  verifyEmail: (email: string, token: string) => Promise<{ error?: string }>;
  resendVerificationCode: (email: string) => Promise<{ error?: string }>;

  // --- 密码重置 ---
  resetToDefaultPassword: (tokenHash: string) => Promise<{ error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error?: string }>;

  // --- 档案操作 ---
  fetchProfile: () => Promise<void>;
  updateProfile: (data: { display_name?: string }) => Promise<{ error?: string }>;

  // --- 会员操作 ---
  checkAndUpdateTrialExpiry: () => Promise<void>;
  upgradeMembership: (tier: MembershipTier, plan: 'monthly' | 'yearly' | 'lifetime') => Promise<{ error?: string }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  session: null,
  loading: true,
  initialized: false,

  // ============================================================
  // 初始化 — 应用启动时调用一次
  // ============================================================
  initialize: async () => {
    try {
      // 获取当前 session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user, session, loading: true });
        await get().fetchProfile();
      }
    } catch {
      // 忽略初始化错误
    } finally {
      set({ loading: false, initialized: true });
    }

    // 监听认证状态变化
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        set({ user: session.user, session });
        await get().fetchProfile();
      } else if (event === 'SIGNED_OUT') {
        // 清除所有本地数据
        try { await clearAllCache(); } catch { /* ignore */ }
        set({ user: null, profile: null, session: null });
      } else if (event === 'TOKEN_REFRESHED' && session) {
        set({ session });
      } else if (event === 'USER_UPDATED' && session?.user) {
        set({ user: session.user, session });
      }
    });
  },

  // ============================================================
  // 注册
  // ============================================================
  signUp: async (email, password, displayName) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: displayName ? { display_name: displayName } : undefined,
      },
    });

    if (error) {
      set({ loading: false });
      return { error: error.message };
    }

    // 注册成功 — 保存 user（session 为 null，需验证邮箱后才可用）
    if (data.user) {
      set({ user: data.user, session: data.session });
    }

    set({ loading: false });
    return {};
  },

  // ============================================================
  // 登录
  // ============================================================
  signIn: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      set({ loading: false });
      return { error: error.message };
    }

    if (data.user) {
      set({ user: data.user, session: data.session });

      // 邮箱未验证 → 拦截登录，要求先验证
      if (!data.user.email_confirmed_at) {
        set({ loading: false });
        return { needVerification: true };
      }

      await get().fetchProfile();
    }

    set({ loading: false });
    return {};
  },

  // ============================================================
  // 登出
  // ============================================================
  signOut: async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }

    // 清除 IndexedDB 缓存
    try { await clearAllCache(); } catch { /* ignore */ }

    set({ user: null, profile: null, session: null });
  },

  // ============================================================
  // 发送密码重置邮件
  // ============================================================
  sendPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/',
    });
    if (error) return { error: error.message };
    return {};
  },

  // ============================================================
  // 邮箱验证码 — 验证注册确认码
  // ============================================================
  verifyEmail: async (email, token) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });

    if (error) {
      set({ loading: false });
      return { error: error.message };
    }

    // 验证成功 → 保存新 session（email_confirmed_at 已设置）
    if (data.session) {
      set({ user: data.user, session: data.session });
      await get().fetchProfile();
    }

    set({ loading: false });
    return {};
  },

  // ============================================================
  // 重新发送验证码
  // ============================================================
  resendVerificationCode: async (email) => {
    const { error } = await supabase.auth.resend({
      email,
      type: 'signup',
    });
    if (error) return { error: error.message };
    return {};
  },

  // ============================================================
  // 密码重置 — 验证恢复 token 后重置为默认密码
  // ============================================================
  resetToDefaultPassword: async (tokenHash) => {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    });

    if (error) {
      const msg = error.message.includes('No API key') || error.message.includes('apikey')
        ? '服务配置错误，请稍后重试'
        : '链接已过期或无效，请重新发送';
      return { error: msg };
    }

    if (data.session) {
      set({ user: data.user, session: data.session });
    }

    // 重置为默认密码
    const { error: updateError } = await supabase.auth.updateUser({
      password: '123456789',
    });

    if (updateError) return { error: updateError.message };
    return {};
  },

  // ============================================================
  // 直接修改密码 — 验证原密码后更新
  // ============================================================
  changePassword: async (currentPassword, newPassword) => {
    const email = get().user?.email;
    if (!email) return { error: '未登录' };

    set({ loading: true });

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      set({ loading: false });
      return { error: '原密码错误' };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      set({ loading: false });
      return { error: updateError.message };
    }

    set({ loading: false });
    return {};
  },

  // ============================================================
  // 拉取用户档案 + 检查试用过期
  // ============================================================
  fetchProfile: async () => {
    const userId = get().user?.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return;

    const profile = data as UserProfile;
    set({ profile });

    // 检查试用是否过期
    await get().checkAndUpdateTrialExpiry();
  },

  // ============================================================
  // 更新档案
  // ============================================================
  updateProfile: async (data) => {
    const userId = get().user?.id;
    if (!userId) return { error: '未登录' };

    const { error } = await supabase
      .from('profiles')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) return { error: error.message };

    // 刷新本地 profile
    await get().fetchProfile();
    return {};
  },

  // ============================================================
  // 检查并处理试用过期（通过 RPC，避免直接修改 profiles）
  // ============================================================
  checkAndUpdateTrialExpiry: async () => {
    const profile = get().profile;
    if (!profile) return;

    if (profile.membership_tier === 'premium') {
      const { data, error } = await supabase.rpc('check_trial_expiry');
      if (!error && data && (data as { downgraded: boolean; tier: string }).downgraded) {
        set({ profile: { ...profile, membership_tier: 'free' } });
      }
    }
  },

  // ============================================================
  // 升级会员（Mock 购买 — 通过 RPC 安全执行）
  // ============================================================
  upgradeMembership: async (tier, plan) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('upgrade_membership', {
      target_tier: tier,
      target_plan: plan,
    });

    if (error) return { error: error.message };

    const result = data as { success?: boolean; error?: string };
    if (result?.error) return { error: result.error };

    // 刷新本地状态
    await get().fetchProfile();
    return {};
  },
}));
