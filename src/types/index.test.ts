import { describe, it, expect } from 'vitest';
import {
  AMOUNT_REGEX,
  AMOUNT_MAX,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_ACCOUNTS,
} from './index';

describe('AMOUNT_REGEX — 金额校验正则', () => {
  it('正常：整数金额通过校验', () => {
    expect(AMOUNT_REGEX.test('100')).toBe(true);
  });

  it('正常：带两位小数的金额通过校验', () => {
    expect(AMOUNT_REGEX.test('100.50')).toBe(true);
  });

  it('正常：0.01 通过校验', () => {
    expect(AMOUNT_REGEX.test('0.01')).toBe(true);
  });

  it('正常：8位整数通过校验', () => {
    expect(AMOUNT_REGEX.test('99999999')).toBe(true);
  });

  it('边界：0 通过校验', () => {
    expect(AMOUNT_REGEX.test('0')).toBe(true);
  });

  it('边界：空字符串不通过', () => {
    expect(AMOUNT_REGEX.test('')).toBe(false);
  });

  it('边界：负数不通过', () => {
    expect(AMOUNT_REGEX.test('-100')).toBe(false);
  });

  it('边界：两位以上小数不通过', () => {
    expect(AMOUNT_REGEX.test('100.123')).toBe(false);
  });

  it('边界：9位整数不通过（超过最大值）', () => {
    expect(AMOUNT_REGEX.test('999999999')).toBe(false);
  });

  it('异常：纯字母不通过', () => {
    expect(AMOUNT_REGEX.test('abc')).toBe(false);
  });

  it('异常：包含特殊字符不通过', () => {
    expect(AMOUNT_REGEX.test('100$')).toBe(false);
  });
});

describe('AMOUNT_MAX — 金额上限', () => {
  it('正常：值为 99999999.99', () => {
    expect(AMOUNT_MAX).toBe(99999999.99);
  });
});

describe('DEFAULT_EXPENSE_CATEGORIES — 默认支出分类', () => {
  it('正常：包含 8 个分类', () => {
    expect(DEFAULT_EXPENSE_CATEGORIES).toHaveLength(8);
  });

  it('正常：所有分类 type 均为 expense', () => {
    DEFAULT_EXPENSE_CATEGORIES.forEach((cat) => {
      expect(cat.type).toBe('expense');
    });
  });

  it('正常：所有分类 is_default 均为 true', () => {
    DEFAULT_EXPENSE_CATEGORIES.forEach((cat) => {
      expect(cat.is_default).toBe(true);
    });
  });

  it('正常：包含餐饮和交通等常见分类', () => {
    const names = DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name);
    expect(names).toContain('餐饮');
    expect(names).toContain('交通');
    expect(names).toContain('住房');
    expect(names).toContain('娱乐');
  });
});

describe('DEFAULT_INCOME_CATEGORIES — 默认收入分类', () => {
  it('正常：包含 4 个分类', () => {
    expect(DEFAULT_INCOME_CATEGORIES).toHaveLength(4);
  });

  it('正常：所有分类 type 均为 income', () => {
    DEFAULT_INCOME_CATEGORIES.forEach((cat) => {
      expect(cat.type).toBe('income');
    });
  });

  it('正常：所有分类 is_default 均为 true', () => {
    DEFAULT_INCOME_CATEGORIES.forEach((cat) => {
      expect(cat.is_default).toBe(true);
    });
  });

  it('正常：包含工资和投资等常见分类', () => {
    const names = DEFAULT_INCOME_CATEGORIES.map((c) => c.name);
    expect(names).toContain('工资');
    expect(names).toContain('奖金');
    expect(names).toContain('投资');
  });
});

describe('DEFAULT_ACCOUNTS — 默认账户', () => {
  it('正常：包含 4 个账户', () => {
    expect(DEFAULT_ACCOUNTS).toHaveLength(4);
  });

  it('正常：包含现金和银行卡等常见账户', () => {
    const names = DEFAULT_ACCOUNTS.map((a) => a.name);
    expect(names).toContain('现金');
    expect(names).toContain('银行卡');
    expect(names).toContain('支付宝');
    expect(names).toContain('微信');
  });

  it('正常：所有账户初始余额为 0', () => {
    DEFAULT_ACCOUNTS.forEach((acc) => {
      expect(acc.balance).toBe(0);
    });
  });

  it('正常：所有账户币种为 CNY', () => {
    DEFAULT_ACCOUNTS.forEach((acc) => {
      expect(acc.currency).toBe('CNY');
    });
  });
});
