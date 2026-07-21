// ============================================================
// Colin记账 — 数据模型类型定义
// 与 Supabase PostgreSQL Schema 对齐
// ============================================================

// ---- 账户 ----
export type AccountType = '现金' | '银行卡' | '信用卡' | '支付宝' | '微信';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

// ---- 分类 ----
export type CategoryKind = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  type: CategoryKind;
  parent_id: string | null;
  icon: string | null;
  color: string | null;
  is_default: boolean;
  created_at: string;
}

// ---- 交易 ----
export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  account_id: string;
  category_id: string;
  amount: number;
  type: TransactionType;
  date: string; // ISO 8601 date
  note: string | null;
  created_at: string;
  updated_at: string;
  // 关联数据（查询时 JOIN 得到）
  account?: Account;
  category?: Category;
  tags?: Tag[];
}

// ---- 标签 ----
export interface Tag {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

// ---- 预算 ----
export interface Budget {
  id: string;
  category_id: string | null; // null = 总预算
  amount: number;
  period: string;
  start_date: string;
  created_at: string;
  updated_at: string;
  // 关联
  category?: Category;
}

// ---- 表单类型 ----
export interface TransactionFormData {
  account_id: string;
  category_id: string;
  amount: string; // 字符串用于表单输入
  type: TransactionType;
  date: string;
  note: string;
  tag_ids: string[];
}

// ---- 筛选类型 ----
export interface TransactionFilter {
  category_id?: string;
  type?: TransactionType;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  keyword?: string;
}

// ---- 报表类型 ----
export interface MonthlyReport {
  total_income: number;
  total_expense: number;
  balance: number;
  by_category: CategorySummary[];
  daily_trend: DailyTrend[];
}

export interface CategorySummary {
  category_id: string;
  category_name: string;
  category_color: string | null;
  amount: number;
  percentage: number;
}

export interface DailyTrend {
  date: string;
  income: number;
  expense: number;
}

// ---- 预设默认分类 ----
export const DEFAULT_EXPENSE_CATEGORIES: Omit<Category, 'id' | 'created_at'>[] = [
  { name: '餐饮', type: 'expense', parent_id: null, icon: 'CoffeeOutlined', color: '#FF6B6B', is_default: true },
  { name: '交通', type: 'expense', parent_id: null, icon: 'CarOutlined', color: '#4ECDC4', is_default: true },
  { name: '住房', type: 'expense', parent_id: null, icon: 'HomeOutlined', color: '#45B7D1', is_default: true },
  { name: '娱乐', type: 'expense', parent_id: null, icon: 'SmileOutlined', color: '#F7DC6F', is_default: true },
  { name: '购物', type: 'expense', parent_id: null, icon: 'ShoppingOutlined', color: '#BB8FCE', is_default: true },
  { name: '医疗', type: 'expense', parent_id: null, icon: 'MedicineBoxOutlined', color: '#E74C3C', is_default: true },
  { name: '教育', type: 'expense', parent_id: null, icon: 'BookOutlined', color: '#3498DB', is_default: true },
  { name: '其他', type: 'expense', parent_id: null, icon: 'EllipsisOutlined', color: '#95A5A6', is_default: true },
];

export const DEFAULT_INCOME_CATEGORIES: Omit<Category, 'id' | 'created_at'>[] = [
  { name: '工资', type: 'income', parent_id: null, icon: 'DollarOutlined', color: '#27AE60', is_default: true },
  { name: '奖金', type: 'income', parent_id: null, icon: 'GiftOutlined', color: '#2ECC71', is_default: true },
  { name: '投资', type: 'income', parent_id: null, icon: 'RiseOutlined', color: '#1ABC9C', is_default: true },
  { name: '其他', type: 'income', parent_id: null, icon: 'EllipsisOutlined', color: '#7DCEA0', is_default: true },
];

export const DEFAULT_ACCOUNTS: Omit<Account, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: '现金', type: '现金', balance: 0, currency: 'CNY' },
  { name: '银行卡', type: '银行卡', balance: 0, currency: 'CNY' },
  { name: '支付宝', type: '支付宝', balance: 0, currency: 'CNY' },
  { name: '微信', type: '微信', balance: 0, currency: 'CNY' },
];

// 金额校验
export const AMOUNT_MAX = 99999999.99;
export const AMOUNT_REGEX = /^\d{1,8}(\.\d{0,2})?$/;
