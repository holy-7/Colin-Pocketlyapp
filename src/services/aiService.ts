/**
 * aiService.ts — AI API 集成 + tool_use 循环（OpenAI 兼容协议）
 *
 * 负责：
 * 1. 初始化 OpenAI 客户端（自定义 baseURL 指向 Agnes AI）
 * 2. 发送用户消息 + 系统提示词
 * 3. 处理 function calling → 执行本地工具 → 返回结果
 * 4. 流式响应转文本消息
 * 5. 预算控制（最大轮数、Token 限制）
 */

import OpenAI from 'openai';
import { AI_TOOLS, executeToolCall } from '@/services/aiTools';

// ============================================================
// 类型
// ============================================================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** 是否为 tool 调用过程中的中间消息（用户不可见） */
  isToolIntermediate?: boolean;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
}

// ============================================================
// 预算控制
// ============================================================

const MAX_TOOL_ROUNDS = 10;
const MAX_OUTPUT_TOKENS = 4096;
const DAILY_CALL_LIMIT = 50;

let dailyCallCount = 0;
let lastCallDate = '';

function checkDailyLimit(): boolean {
  const today = new Date().toDateString();
  if (today !== lastCallDate) {
    dailyCallCount = 0;
    lastCallDate = today;
  }
  if (dailyCallCount >= DAILY_CALL_LIMIT) {
    throw new Error('今日 AI 调用次数已达上限（50 次），请明天再试');
  }
  dailyCallCount++;
  return true;
}

// ============================================================
// OpenAI 客户端（自定义端点）
// ============================================================

function getClient(): OpenAI | null {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
  const baseURL = import.meta.env.VITE_AI_API_BASE_URL;
  if (!apiKey || apiKey === 'your-api-key-here') {
    return null;
  }
  // Security: dangerouslyAllowBrowser is required for Electron renderer.
  // The API key comes from the local .env file, never exposed publicly.
  return new OpenAI({
    apiKey,
    baseURL: baseURL || undefined,
    dangerouslyAllowBrowser: true,
  });
}

// ============================================================
// 系统提示词
// ============================================================

const SYSTEM_PROMPT = `你是 Colin记账 的 AI 财务助手。你的职责是帮助用户分析个人财务数据。

## 核心规则
1. **数据来源**：你只能通过提供的函数工具获取数据。绝对不要编造任何数字。
2. **隐私**：你收到的数据已经是聚合统计，不包含单笔交易明细。不要询问或推测单笔交易的具体信息。
3. **限制**：不要声称你可以"删除数据"、"修改账户"、"转账"等需要写权限的操作。这些需要用户在设置页手动完成。
4. **语气**：友好、简洁。用中文回答。数据用人民币（¥）表示。
5. **边界**：
   - 如果用户问未来数据（如"明天"），礼貌说明你只能分析已有数据
   - 如果用户问模糊问题（如"我花钱多吗"），对比历史均值给出参考
   - 如果用户要求危险操作（如"删除所有数据"），拒绝并引导到设置页
   - 如果数据不足（如新用户只有几天数据），如实告知

## 当前日期
${new Date().toISOString().split('T')[0]}`;

// ============================================================
// 工具定义转换：Anthropic 格式 → OpenAI 格式
// ============================================================

const OPENAI_TOOLS = AI_TOOLS.map((t) => ({
  type: 'function' as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

// ============================================================
// 核心 API：发送消息并获取回复
// ============================================================

export async function sendMessage(
  userMessage: string,
  messageHistory: ChatMessage[],
  onStream?: (chunk: string) => void,
): Promise<ChatMessage[]> {
  const client = getClient();
  if (!client) {
    return [{
      role: 'assistant',
      content: '⚠️ AI 助手尚未配置。请在 `.env` 文件中设置 `VITE_CLAUDE_API_KEY` 以启用 AI 功能。',
    }];
  }

  checkDailyLimit();

  // 构建消息历史
  const visibleMessages = messageHistory.filter((m) => !m.isToolIntermediate);
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...visibleMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const newMessages: ChatMessage[] = [{ role: 'user', content: userMessage }];

  try {
    const response = await runToolLoop(client, messages, onStream);
    newMessages.push({ role: 'assistant', content: response });
    return newMessages;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '未知错误';
    console.error('[AIService] API error:', errorMsg);

    if (errorMsg.includes('今日 AI 调用次数')) {
      return [{ role: 'assistant', content: '⚠️ ' + errorMsg }];
    }

    if (errorMsg.includes('API key') || errorMsg.includes('authentication') || errorMsg.includes('401')) {
      return [{ role: 'assistant', content: '⚠️ API Key 无效或已过期，请检查 `.env` 文件中的 `VITE_CLAUDE_API_KEY`。' }];
    }

    return [{ role: 'assistant', content: `⚠️ AI 服务暂时不可用：${errorMsg}。请稍后重试。` }];
  }
}

// ============================================================
// Tool use 循环（OpenAI 协议）
// ============================================================

async function runToolLoop(
  client: OpenAI,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  onStream?: (chunk: string) => void,
): Promise<string> {
  let currentMessages = [...messages];
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;

    const response = await client.chat.completions.create({
      model: 'agnes-2.5-flash',
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: currentMessages,
      tools: OPENAI_TOOLS,
    });

    const choice = response.choices[0];
    if (!choice) {
      return '抱歉，AI 未返回有效响应。';
    }

    const { message } = choice;

    // 如果模型想调用工具
    if (message.tool_calls && message.tool_calls.length > 0) {
      // 推送文本部分（如果有）
      if (message.content && onStream) {
        onStream(message.content);
      }

      // 将 assistant 消息（含 tool_calls）追加到历史
      currentMessages.push({
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      });

      // 执行每个 tool_call 并追加结果
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        let toolInput: Record<string, unknown> = {};

        try {
          toolInput = JSON.parse(toolCall.function.arguments);
        } catch {
          toolInput = {};
        }

        let toolResult: string;
        try {
          toolResult = await executeToolCall(toolName, toolInput);
        } catch (err) {
          toolResult = JSON.stringify({ error: `Tool execution failed: ${err}` });
        }

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      continue; // 继续循环，让模型处理 tool 结果
    }

    // 普通文本回复
    const content = message.content || '';
    if (content && onStream) {
      onStream(content);
    }
    return content;
  }

  // 超过最大轮数
  currentMessages.push({
    role: 'user',
    content: '已超过最大工具调用轮数。请基于已获取的数据直接给出最终回答，不要再调用工具。',
  });

  const finalResponse = await client.chat.completions.create({
    model: 'agnes-2.5-flash',
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: currentMessages,
  });

  return finalResponse.choices[0]?.message?.content || '抱歉，分析超时。请尝试更具体的问题。';
}
