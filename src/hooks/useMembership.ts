import { useResponsive } from '@/hooks/useResponsive';
import { useAuthStore } from '@/stores/authStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useBudgetStore } from '@/stores/budgetStore';

// ============================================================
// useMembership — 功能门控 Hook
// 桌面端：全部放行
// 移动端 premium/lifetime：全部放行
// 移动端 free：根据限制判断
// ============================================================

// 会员限制常量
const FREE_LIMITS = {
  maxAccounts: 3,
  maxCustomCategories: 5,
  maxBudgets: 3,
  maxAIPerDay: 3,
};

const ALLOWED_EXPORT_FORMATS_FREE = ['csv'];

export interface MembershipGates {
  canAddAccount: boolean;
  canAddCategory: boolean;
  canAddBudget: boolean;
  canUseAI: boolean;
  canExport: (format: string) => boolean;
  getLimitMessage: (feature: string) => string;
  remainingAccounts: number;
  remainingCategories: number;
  remainingBudgets: number;
}

export function useMembership(): MembershipGates {
  const { isMobile } = useResponsive();
  const profile = useAuthStore((s) => s.profile);
  const accounts = useAccountStore((s) => s.accounts);
  const categories = useCategoryStore((s) => s.categories);
  const budgets = useBudgetStore((s) => s.budgets);

  // 桌面端：全部功能不受限
  if (!isMobile) {
    return {
      canAddAccount: true,
      canAddCategory: true,
      canAddBudget: true,
      canUseAI: true,
      canExport: () => true,
      getLimitMessage: () => '',
      remainingAccounts: Infinity,
      remainingCategories: Infinity,
      remainingBudgets: Infinity,
    };
  }

  const tier = profile?.membership_tier ?? 'free';
  const isPremium = tier === 'premium' || tier === 'lifetime';

  // 计算当前使用量（只统计非默认分类）
  const customCategoryCount = categories.filter((c) => !c.is_default).length;

  const remainingAccounts = isPremium ? Infinity : Math.max(0, FREE_LIMITS.maxAccounts - accounts.length);
  const remainingCategories = isPremium ? Infinity : Math.max(0, FREE_LIMITS.maxCustomCategories - customCategoryCount);
  const remainingBudgets = isPremium ? Infinity : Math.max(0, FREE_LIMITS.maxBudgets - budgets.length);

  return {
    canAddAccount: isPremium || accounts.length < FREE_LIMITS.maxAccounts,
    canAddCategory: isPremium || customCategoryCount < FREE_LIMITS.maxCustomCategories,
    canAddBudget: isPremium || budgets.length < FREE_LIMITS.maxBudgets,
    canUseAI: isPremium,  // AI 次数由 dailyTracking 在调用时实时判断
    canExport: (format: string) => isPremium || ALLOWED_EXPORT_FORMATS_FREE.includes(format.toLowerCase()),
    getLimitMessage: (feature: string) => {
      const map: Record<string, string> = {
        account: `免费版最多 ${FREE_LIMITS.maxAccounts} 个账户，升级会员即可无限添加`,
        category: `免费版最多 ${FREE_LIMITS.maxCustomCategories} 个自定义分类，升级会员即可无限添加`,
        budget: `免费版最多 ${FREE_LIMITS.maxBudgets} 个预算，升级会员即可无限添加`,
        ai: `免费版每天 ${FREE_LIMITS.maxAIPerDay} 次 AI 查询，升级会员即可无限使用`,
        export: '免费版仅支持 CSV 导出，升级会员解锁全部格式',
      };
      return map[feature] || '升级会员即可解锁此功能';
    },
    remainingAccounts,
    remainingCategories,
    remainingBudgets,
  };
}
