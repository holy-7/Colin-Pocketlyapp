import { create } from 'zustand';

// ============================================================
// MembershipStore — 会员用量追踪（每日限制）
// 使用 localStorage 按日期 key 追踪
// ============================================================

interface DailyUsage {
  aiQueries: number;
  exports: number;
}

interface MembershipState {
  // 获取当日用量
  getTodayUsage: () => DailyUsage;
  // 增加 AI 查询次数
  incrementAI: () => void;
  // 获取今日 AI 剩余次数
  getRemainingAI: () => number;
  // 检查可否使用 AI
  canUseAI: () => boolean;
}

const MAX_AI_PER_DAY = 3;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadUsage(): DailyUsage {
  try {
    const raw = localStorage.getItem(`usage_${todayKey()}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { aiQueries: 0, exports: 0 };
}

function saveUsage(usage: DailyUsage) {
  try {
    localStorage.setItem(`usage_${todayKey()}`, JSON.stringify(usage));
  } catch { /* ignore */ }
}

export const useMembershipStore = create<MembershipState>(() => ({
  getTodayUsage: () => loadUsage(),

  incrementAI: () => {
    const usage = loadUsage();
    usage.aiQueries += 1;
    saveUsage(usage);
  },

  getRemainingAI: () => {
    const usage = loadUsage();
    return Math.max(0, MAX_AI_PER_DAY - usage.aiQueries);
  },

  canUseAI: () => {
    const usage = loadUsage();
    return usage.aiQueries < MAX_AI_PER_DAY;
  },
}));
