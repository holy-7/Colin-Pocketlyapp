-- ============================================================
-- Colin记账 — Supabase PostgreSQL Schema
-- 在 Supabase SQL Editor 中执行此文件以初始化数据库
-- ============================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. 账户表
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('现金', '银行卡', '信用卡', '支付宝', '微信')),
  balance DECIMAL(12,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'CNY',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. 分类表
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  icon VARCHAR(50),
  color VARCHAR(20),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. 交易表
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引：加速按日期查询
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- ============================================================
-- 4. 标签表
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. 交易-标签关联表
-- ============================================================
CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

-- ============================================================
-- 6. 预算表
-- ============================================================
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  period VARCHAR(10) DEFAULT 'monthly',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. 插入默认分类
-- ============================================================
INSERT INTO categories (name, type, icon, color, is_default) VALUES
  -- 支出分类
  ('餐饮', 'expense', 'CoffeeOutlined', '#FF6B6B', true),
  ('交通', 'expense', 'CarOutlined', '#4ECDC4', true),
  ('住房', 'expense', 'HomeOutlined', '#45B7D1', true),
  ('娱乐', 'expense', 'SmileOutlined', '#F7DC6F', true),
  ('购物', 'expense', 'ShoppingOutlined', '#BB8FCE', true),
  ('医疗', 'expense', 'MedicineBoxOutlined', '#E74C3C', true),
  ('教育', 'expense', 'BookOutlined', '#3498DB', true),
  ('其他支出', 'expense', 'EllipsisOutlined', '#95A5A6', true),
  -- 收入分类
  ('工资', 'income', 'DollarOutlined', '#27AE60', true),
  ('奖金', 'income', 'GiftOutlined', '#2ECC71', true),
  ('投资', 'income', 'RiseOutlined', '#1ABC9C', true),
  ('其他收入', 'income', 'EllipsisOutlined', '#7DCEA0', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. 插入默认账户
-- ============================================================
INSERT INTO accounts (name, type, balance, currency) VALUES
  ('现金', '现金', 0, 'CNY'),
  ('银行卡', '银行卡', 0, 'CNY'),
  ('支付宝', '支付宝', 0, 'CNY'),
  ('微信', '微信', 0, 'CNY');

-- ============================================================
-- 9. Row Level Security（MVP-1：全部允许，后续版本收紧）
-- ============================================================
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE budgets DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. Realtime 订阅（启用实时同步）
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE budgets;
