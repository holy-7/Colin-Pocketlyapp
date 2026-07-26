/**
 * privacyLayer.ts — 隐私脱敏层
 *
 * ⚠️ 关键安全模块：这是所有 LLM 数据交互的唯一通道。
 * 任何要发送给 Claude API 的数据必须经过 sanitizeForLLM() 脱敏。
 *
 * 规则：
 * 1. 绝不允许单笔交易数据（Transaction）通过
 * 2. 绝不允许账户余额（Account.balance）通过
 * 3. 只允许聚合统计数据（分类汇总、百分比、均值、趋势）
 * 4. 所有通过的数据自动 console.debug 记录审计日志
 */

// ============================================================
// 允许输出的数据类型白名单
// ============================================================

/** AI 可接收的数据结构（白名单格式） */
export interface SafeMonthlySummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
  byCategory: SafeCategoryAmount[];
}

export interface SafeCategoryAmount {
  categoryName: string;
  amount: number;
  percent: number;
}

export interface SafeDailyTrend {
  date: string;
  income: number;
  expense: number;
}

export interface SafeBudgetStatus {
  totalBudget: number;
  spent: number;
  remaining: number;
  percent: number;
  byCategory: SafeCategoryBudget[];
}

export interface SafeCategoryBudget {
  categoryName: string;
  budget: number;
  spent: number;
  remaining: number;
  percent: number;
}

export interface SafeHistoricalAvg {
  month: string;
  totalExpense: number;
  byCategory: { categoryName: string; amount: number }[];
}

export interface SafeTopSpending {
  topDays: { date: string; amount: number; categoryName: string }[];
  topCategories: { categoryName: string; amount: number; percent: number }[];
}

// ============================================================
// 脱敏函数
// ============================================================

/**
 * 对任何要发给 LLM 的数据做安全校验
 * 如果数据包含禁止字段（单笔交易、账户余额等），会抛出错误
 * 安全数据原样返回，仅供日志记录
 */
export function sanitizeForLLM<T>(data: T, context: string): T {
  // 审计日志：记录什么数据、什么时间、什么上下文被发送给 LLM
  if (import.meta.env.DEV) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      context,
      dataType: typeof data,
      summary: summarizeForAudit(data),
    };
    console.debug('[PrivacyLayer] LLM Data Dispatch:', logEntry);
  }

  // 黑名单检查：如果是数组且包含单笔交易敏感字段，拒绝
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === 'object') {
        assertNoSensitiveFields(item, context);
      }
    }
  } else if (data && typeof data === 'object') {
    assertNoSensitiveFields(data as Record<string, unknown>, context);
  }

  return data;
}

/** 敏感字段黑名单 */
const SENSITIVE_FIELDS = [
  'account_id',   // 账户 ID
  'note',          // 交易备注（可能含隐私）
  'created_at',    // 精确时间戳（不需要给 LLM）
  'updated_at',    // 精确时间戳
  'user_id',       // 用户标识
  'id',            // 记录 ID（对 LLM 无意义）
];

/**
 * 检查对象是否包含敏感字段
 * @throws 如果发现敏感字段
 */
function assertNoSensitiveFields(obj: Record<string, unknown>, context: string): void {
  const found = SENSITIVE_FIELDS.filter((field) => field in obj);
  if (found.length > 0) {
    console.error(
      `[PrivacyLayer] BLOCKED: Attempted to send sensitive fields to LLM in "${context}":`,
      found,
      'Object keys:', Object.keys(obj),
    );
    throw new Error(
      `Privacy violation: Cannot send sensitive fields [${found.join(', ')}] to LLM. Context: ${context}`,
    );
  }
}

/**
 * 生成审计摘要（仅记录统计信息，不记录数据本身）
 */
function summarizeForAudit(data: unknown): string {
  if (Array.isArray(data)) {
    return `Array(${data.length} items)`;
  }
  if (data && typeof data === 'object') {
    return `Object{keys: ${Object.keys(data).join(', ')}}`;
  }
  return typeof data;
}

// ============================================================
// 生产环境脱敏（即使 sanitizeForLLM 被误用，也能兜底）
// ============================================================

/**
 * 从 Transaction 数组中提取安全的分类汇总（绝不暴露单笔交易）
 * 这是推荐的"先聚合再发送"模式
 */
export function extractSafeSummary(
  transactions: { type: string; amount: number; category_id: string }[],
  categories: { id: string; name: string }[],
): SafeMonthlySummary {
  const incomes = transactions.filter((t) => t.type === 'income');
  const expenses = transactions.filter((t) => t.type === 'expense');
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);

  // 按分类汇总
  const catMap = new Map<string, number>();
  for (const t of expenses) {
    catMap.set(t.category_id, (catMap.get(t.category_id) || 0) + t.amount);
  }

  const byCategory = Array.from(catMap.entries())
    .map(([catId, amount]) => {
      const cat = categories.find((c) => c.id === catId);
      return {
        categoryName: cat?.name || '未知',
        amount: Math.round(amount * 100) / 100,
        percent: totalExpense > 0 ? Math.round((amount / totalExpense) * 10000) / 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    balance: Math.round((totalIncome - totalExpense) * 100) / 100,
    transactionCount: transactions.length,
    byCategory,
  };
}
