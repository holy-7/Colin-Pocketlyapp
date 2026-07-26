/**
 * chatStore.ts — AI 对话状态管理
 *
 * 管理：
 * - 消息历史
 * - 会话管理
 * - 加载与流式响应状态
 */

import { create } from 'zustand';
import { sendMessage, type ChatMessage } from '@/services/aiService';

// ============================================================
// 类型
// ============================================================

interface ChatState {
  // 消息
  messages: ChatMessage[];
  // 状态
  loading: boolean;
  streaming: string; // 流式响应中正在接收的内容
  error: string | null;
  // 配置
  enabled: boolean; // AI 助手开关

  // 操作
  send: (content: string) => Promise<void>;
  clearHistory: () => void;
  setEnabled: (enabled: boolean) => void;
  clearError: () => void;
}

// ============================================================
// 快捷问题建议
// ============================================================

export const QUICK_QUESTIONS = [
  '这个月我花了多少钱？',
  '最大的支出是什么？',
  '预算还剩多少？',
  '哪个类别花钱最多？',
  '按现在的节奏会超支吗？',
  '过去3个月趋势如何？',
];

// ============================================================
// Store
// ============================================================

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,
  streaming: '',
  error: null,
  enabled: true,

  send: async (content: string) => {
    const { messages, enabled } = get();
    if (!content.trim() || !enabled) return;

    set({ loading: true, streaming: '', error: null });

    try {
      const newMsgs = await sendMessage(
        content,
        messages,
        (chunk: string) => {
          set((s) => ({ streaming: s.streaming + chunk }));
        },
      );

      set((s) => ({
        messages: [...s.messages, ...newMsgs],
        loading: false,
        streaming: '',
      }));
    } catch (err) {
      set({
        loading: false,
        streaming: '',
        error: err instanceof Error ? err.message : '发送失败',
      });
    }
  },

  clearHistory: () => {
    set({ messages: [], streaming: '', error: null });
  },

  setEnabled: (enabled: boolean) => set({ enabled }),

  clearError: () => set({ error: null }),
}));
