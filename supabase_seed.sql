-- ============================================================
-- Colin记账 — 关闭 RLS + 插入默认数据
-- 复制到 Supabase SQL Editor 执行
-- ============================================================

-- 1. 关闭所有表的 RLS（MVP-1 单用户无需行级安全）
ALTER TABLE IF EXISTS accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transaction_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS budgets DISABLE ROW LEVEL SECURITY;

-- 2. 清空并重新插入默认分类
DELETE FROM categories;
INSERT INTO categories (name, type, icon, color, is_default) VALUES
  ('餐饮', 'expense', 'CoffeeOutlined', '#FF6B6B', true),
  ('交通', 'expense', 'CarOutlined', '#4ECDC4', true),
  ('住房', 'expense', 'HomeOutlined', '#45B7D1', true),
  ('娱乐', 'expense', 'SmileOutlined', '#F7DC6F', true),
  ('购物', 'expense', 'ShoppingOutlined', '#BB8FCE', true),
  ('医疗', 'expense', 'MedicineBoxOutlined', '#E74C3C', true),
  ('教育', 'expense', 'BookOutlined', '#3498DB', true),
  ('其他支出', 'expense', 'EllipsisOutlined', '#95A5A6', true),
  ('工资', 'income', 'DollarOutlined', '#27AE60', true),
  ('奖金', 'income', 'GiftOutlined', '#2ECC71', true),
  ('投资', 'income', 'RiseOutlined', '#1ABC9C', true),
  ('其他收入', 'income', 'EllipsisOutlined', '#7DCEA0', true);

-- 3. 清空并重新插入默认账户
DELETE FROM accounts;
INSERT INTO accounts (name, type, balance, currency) VALUES
  ('现金', '现金', 0, 'CNY'),
  ('银行卡', '银行卡', 0, 'CNY'),
  ('支付宝', '支付宝', 0, 'CNY'),
  ('微信', '微信', 0, 'CNY');
