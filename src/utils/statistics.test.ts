/**
 * statistics.test.ts — 统计计算工具单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateByCategory,
  aggregateByDay,
  mean,
  stddev,
  topN,
  detectAnomalies,
  predictMonthEnd,
  computeMonthlySummary,
} from '@/utils/statistics';
import type { Transaction, Category } from '@/types';

// ---- 测试辅助数据 ----

const mockCategories: Category[] = [
  { id: 'cat-1', name: '餐饮', type: 'expense', parent_id: null, icon: null, color: '#FF6B6B', is_default: true, created_at: '2026-01-01' },
  { id: 'cat-2', name: '交通', type: 'expense', parent_id: null, icon: null, color: '#4ECDC4', is_default: true, created_at: '2026-01-01' },
  { id: 'cat-3', name: '工资', type: 'income', parent_id: null, icon: null, color: '#27AE60', is_default: true, created_at: '2026-01-01' },
];

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    account_id: 'acc-1',
    category_id: 'cat-1',
    amount: 100,
    type: 'expense',
    date: '2026-07-01',
    note: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================
// mean
// ============================================================
describe('mean', () => {
  it('计算正常数组的均值', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('空数组返回 0', () => {
    expect(mean([])).toBe(0);
  });

  it('单元素返回自身', () => {
    expect(mean([42])).toBe(42);
  });
});

// ============================================================
// stddev
// ============================================================
describe('stddev', () => {
  it('计算标准差', () => {
    const result = stddev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toBeCloseTo(2, 0);
  });

  it('单元素标准差为 0', () => {
    expect(stddev([5])).toBe(0);
  });

  it('空数组标准差为 0', () => {
    expect(stddev([])).toBe(0);
  });
});

// ============================================================
// topN
// ============================================================
describe('topN', () => {
  it('返回前 N 个', () => {
    const items = [{ amount: 1 }, { amount: 5 }, { amount: 3 }, { amount: 10 }];
    const result = topN(items, 2);
    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(10);
    expect(result[1].amount).toBe(5);
  });

  it('N 超过长度返回全部', () => {
    const items = [{ amount: 1 }, { amount: 2 }];
    expect(topN(items, 10)).toHaveLength(2);
  });
});

// ============================================================
// aggregateByCategory
// ============================================================
describe('aggregateByCategory', () => {
  it('按分类汇总支出', () => {
    const txns = [
      makeTxn({ id: '1', category_id: 'cat-1', amount: 200, type: 'expense' }),
      makeTxn({ id: '2', category_id: 'cat-1', amount: 100, type: 'expense' }),
      makeTxn({ id: '3', category_id: 'cat-2', amount: 100, type: 'expense' }),
      makeTxn({ id: '4', category_id: 'cat-3', amount: 500, type: 'income' }),
    ];

    const result = aggregateByCategory(txns, mockCategories);
    expect(result).toHaveLength(2);
    expect(result[0].categoryName).toBe('餐饮');
    expect(result[0].amount).toBe(300);
    expect(result[0].percent).toBe(75); // 300/400
    expect(result[1].categoryName).toBe('交通');
    expect(result[1].amount).toBe(100);
  });

  it('无支出时返回空数组', () => {
    const txns = [makeTxn({ type: 'income' })];
    expect(aggregateByCategory(txns, mockCategories)).toHaveLength(0);
  });
});

// ============================================================
// aggregateByDay
// ============================================================
describe('aggregateByDay', () => {
  it('按天汇总收支', () => {
    const txns = [
      makeTxn({ id: '1', date: '2026-07-01', amount: 100, type: 'expense' }),
      makeTxn({ id: '2', date: '2026-07-01', amount: 200, type: 'income' }),
      makeTxn({ id: '3', date: '2026-07-02', amount: 50, type: 'expense' }),
    ];

    const result = aggregateByDay(txns);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-07-01');
    expect(result[0].expense).toBe(100);
    expect(result[0].income).toBe(200);
    expect(result[1].date).toBe('2026-07-02');
    expect(result[1].expense).toBe(50);
  });
});

// ============================================================
// detectAnomalies（3σ 检测）
// ============================================================
describe('detectAnomalies', () => {
  it('正常支出不报告异常', () => {
    // 历史：每月餐饮 100 左右
    const history = [
      [makeTxn({ category_id: 'cat-1', amount: 100 })],
      [makeTxn({ category_id: 'cat-1', amount: 110 })],
      [makeTxn({ category_id: 'cat-1', amount: 90 })],
    ];
    // 当月：餐饮 120，在正常波动范围
    const current = [makeTxn({ category_id: 'cat-1', amount: 120 })];

    const result = detectAnomalies(current, history, mockCategories);
    // 120 对均值 100 标准差 ~8.16，3σ threshold ≈ 124.5，不超
    expect(result).toHaveLength(0);
  });

  it('检测到异常高支出', () => {
    const history = [
      [makeTxn({ category_id: 'cat-1', amount: 100 })],
      [makeTxn({ category_id: 'cat-1', amount: 110 })],
      [makeTxn({ category_id: 'cat-1', amount: 90 })],
    ];
    // 当月餐饮 500，远超 3σ
    const current = [makeTxn({ category_id: 'cat-1', amount: 500 })];

    const result = detectAnomalies(current, history, mockCategories);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('critical'); // >5σ
  });

  it('不足 3 个月历史不检测', () => {
    const history = [[makeTxn({ category_id: 'cat-1', amount: 100 })]];
    const current = [makeTxn({ category_id: 'cat-1', amount: 5000 })];

    expect(detectAnomalies(current, history, mockCategories)).toHaveLength(0);
  });
});

// ============================================================
// predictMonthEnd（趋势预测）
// ============================================================
describe('predictMonthEnd', () => {
  it('预测月度总支出', () => {
    // 前 10 天，每天消费 100
    const txns = Array.from({ length: 10 }, (_, i) =>
      makeTxn({ id: String(i), date: `2026-07-${String(i + 1).padStart(2, '0')}`, amount: 100 }),
    );

    const result = predictMonthEnd(txns, 3000, 31);
    expect(result.dailyAvg).toBe(100);
    expect(result.projectedTotal).toBe(3100);
    expect(result.willOverspend).toBe(true); // 3100 > 3000
    expect(result.daysOfData).toBe(10);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('无数据时返回零值', () => {
    const result = predictMonthEnd([], 3000, 31);
    expect(result.dailyAvg).toBe(0);
    expect(result.projectedTotal).toBe(0);
    expect(result.willOverspend).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('无预算时 willOverspend 为 false', () => {
    const txns = [makeTxn({ amount: 10000 })]; // 一天花很多
    const result = predictMonthEnd(txns, null, 31);
    expect(result.willOverspend).toBe(false);
  });
});

// ============================================================
// computeMonthlySummary
// ============================================================
describe('computeMonthlySummary', () => {
  it('正确计算收支结余', () => {
    const txns = [
      makeTxn({ id: '1', type: 'expense', category_id: 'cat-1', amount: 200 }),
      makeTxn({ id: '2', type: 'expense', category_id: 'cat-2', amount: 100 }),
      makeTxn({ id: '3', type: 'income', category_id: 'cat-3', amount: 500 }),
    ];

    const result = computeMonthlySummary(txns, mockCategories);
    expect(result.totalIncome).toBe(500);
    expect(result.totalExpense).toBe(300);
    expect(result.balance).toBe(200);
    expect(result.transactionCount).toBe(3);
    expect(result.byCategory).toHaveLength(2); // 2 个支出分类
  });
});
