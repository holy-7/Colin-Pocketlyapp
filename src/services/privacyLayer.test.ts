/**
 * privacyLayer.test.ts — 隐私脱敏层单元测试
 *
 * 关键验证：
 * 1. 安全聚合数据可以通过
 * 2. 包含敏感字段的数据会被拒绝
 * 3. 安全数据提取函数不泄露单笔交易
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeForLLM,
  extractSafeSummary,
} from '@/services/privacyLayer';
import type { SafeMonthlySummary } from '@/services/privacyLayer';

// ============================================================
// sanitizeForLLM
// ============================================================
describe('sanitizeForLLM — 安全数据通过', () => {
  it('安全的月度汇总可以通过', () => {
    const data: SafeMonthlySummary = {
      totalIncome: 5000,
      totalExpense: 3000,
      balance: 2000,
      transactionCount: 15,
      byCategory: [
        { categoryName: '餐饮', amount: 1000, percent: 33.3 },
        { categoryName: '交通', amount: 500, percent: 16.7 },
      ],
    };
    const result = sanitizeForLLM(data, 'test');
    expect(result).toEqual(data);
  });

  it('空数组可以通过', () => {
    expect(sanitizeForLLM([], 'test')).toEqual([]);
  });

  it('安全字符串可以通过', () => {
    expect(sanitizeForLLM('hello', 'test')).toBe('hello');
  });
});

describe('sanitizeForLLM — 敏感数据被拒绝', () => {
  it('包含 account_id 的数据被拒绝', () => {
    expect(() =>
      sanitizeForLLM([{ categoryName: '餐饮', account_id: 'acc-123', amount: 100 }], 'test'),
    ).toThrow('Privacy violation');
  });

  it('包含 note 的数据被拒绝', () => {
    expect(() =>
      sanitizeForLLM([{ categoryName: '餐饮', note: '个人备注' }], 'test'),
    ).toThrow('Privacy violation');
  });

  it('包含 created_at 的数据被拒绝', () => {
    expect(() =>
      sanitizeForLLM([{ categoryName: '餐饮', created_at: '2026-01-01' }], 'test'),
    ).toThrow('Privacy violation');
  });

  it('包含 updated_at 的数据被拒绝', () => {
    expect(() =>
      sanitizeForLLM([{ categoryName: '餐饮', updated_at: '2026-01-01' }], 'test'),
    ).toThrow('Privacy violation');
  });

  it('包含 id 的数据被拒绝', () => {
    expect(() =>
      sanitizeForLLM([{ id: 'txn-123', categoryName: '餐饮' }], 'test'),
    ).toThrow('Privacy violation');
  });
});

// ============================================================
// extractSafeSummary（安全提取）
// ============================================================
describe('extractSafeSummary', () => {
  it('从交易数据提取安全汇总，不泄露单笔', () => {
    const transactions = [
      { type: 'expense', amount: 200, category_id: 'cat-1' },
      { type: 'expense', amount: 100, category_id: 'cat-1' },
      { type: 'expense', amount: 50, category_id: 'cat-2' },
      { type: 'income', amount: 500, category_id: 'cat-3' },
    ];
    const categories = [
      { id: 'cat-1', name: '餐饮' },
      { id: 'cat-2', name: '交通' },
    ];

    const result = extractSafeSummary(transactions, categories);

    expect(result.totalIncome).toBe(500);
    expect(result.totalExpense).toBe(350);
    expect(result.balance).toBe(150);
    expect(result.transactionCount).toBe(4);
    expect(result.byCategory).toHaveLength(2);
    expect(result.byCategory[0].categoryName).toBe('餐饮');
    expect(result.byCategory[0].amount).toBe(300);

    // 验证结果中不含任何原始交易敏感字段
    const json = JSON.stringify(result);
    expect(json).not.toContain('account_id');
    expect(json).not.toContain('note');
    expect(json).not.toContain('cat-1'); // 分类 ID 不应泄露
    expect(json).not.toContain('cat-2');
  });
});
