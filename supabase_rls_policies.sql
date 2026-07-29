-- ============================================================
-- RLS 策略 — 已在 Supabase 上执行，此文件供参考/备份
-- ============================================================

-- 1. 数据表：SELECT/UPDATE/DELETE（自己的数据 + 模板数据 user_id IS NULL）
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acct_select" ON accounts FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
-- INSERT 含会员限制检查（见下方）
CREATE POLICY "acct_update" ON accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "acct_delete" ON accounts FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_select" ON categories FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "cat_update" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cat_delete" ON categories FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_select" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tx_insert" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tx_update" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tx_delete" ON transactions FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tag_select" ON tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tag_insert" ON tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tag_update" ON tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tag_delete" ON tags FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bud_select" ON budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bud_update" ON budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "bud_delete" ON budgets FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE transaction_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tt_select" ON transaction_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = transaction_tags.transaction_id AND t.user_id = auth.uid()));
CREATE POLICY "tt_insert" ON transaction_tags FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM transactions t WHERE t.id = transaction_tags.transaction_id AND t.user_id = auth.uid()));

-- 2. INSERT 策略（含服务端会员限制）
CREATE POLICY "acct_insert" ON accounts FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND membership_tier IN ('premium', 'lifetime'))
    OR (SELECT COUNT(*) FROM accounts WHERE user_id = auth.uid()) < 3
  )
);

CREATE POLICY "cat_insert" ON categories FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND membership_tier IN ('premium', 'lifetime'))
    OR (SELECT COUNT(*) FROM categories WHERE user_id = auth.uid() AND is_default = false) < 5
  )
);

CREATE POLICY "bud_insert" ON budgets FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND membership_tier IN ('premium', 'lifetime'))
    OR (SELECT COUNT(*) FROM budgets WHERE user_id = auth.uid()) < 3
  )
);

-- 3. profiles：读取 + 受限更新（敏感字段由触发器保护）
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prof_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "prof_update" ON profiles FOR UPDATE USING (auth.uid() = id);
-- 触发器 check_profile_update 阻止非 service_role 直接修改 membership_tier / premium_expires_at

-- 4. user_subscriptions：只读
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_select" ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);

-- 5. RPC 函数（SECURITY DEFINER）
-- check_trial_expiry() — 检查并降级过期试用
-- upgrade_membership(target_tier, target_plan) — 安全执行会员升级

-- 6. handle_new_user 触发器（仅创建 profile + 7 天试用，不再复制分类/账户）
-- 模板数据（user_id IS NULL）通过 RLS SELECT 策略对所有已登录用户全局可见
--
-- 当前 SQL（已在数据库更新）：
-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS trigger AS $$
-- BEGIN
--   INSERT INTO public.profiles (id, display_name, membership_tier, premium_expires_at)
--   VALUES (
--     NEW.id,
--     COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
--     'premium',
--     NOW() + INTERVAL '7 days'
--   );
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 管理员账户
-- admin@colin.app（终身会员），密码存储于外部密钥管理器
-- 拥有所有迁移的旧数据（交易/预算/自定义分类）
