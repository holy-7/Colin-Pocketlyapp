import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Spin } from 'antd';
import AppLayout from '@/components/AppLayout';
import AuthGuard from '@/components/auth/AuthGuard';
import LoginPage from '@/components/auth/LoginPage';
import HomePage from '@/pages/HomePage';
import RecordPage from '@/pages/RecordPage';
import MobileRecordPage from '@/pages/MobileRecordPage';
import MobileBudgetPage from '@/pages/MobileBudgetPage';
import StatisticsPage from '@/pages/StatisticsPage';
import DiscoverPage from '@/pages/DiscoverPage';
import AIChatPage from '@/pages/AIChatPage';
import SettingsPage from '@/pages/SettingsPage';
import MembershipPage from '@/pages/MembershipPage';

import { SyncProvider } from '@/services/syncContext';
import { useAuthStore } from '@/stores/authStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useAccountStore } from '@/stores/accountStore';
import { useBudgetStore } from '@/stores/budgetStore';

export default function App() {
  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.initialized);
  const authLoading = useAuthStore((s) => s.loading);
  const initializeAuth = useAuthStore((s) => s.initialize);

  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const fetchAccounts = useAccountStore((s) => s.fetchAccounts);
  const fetchBudgets = useBudgetStore((s) => s.fetchBudgets);
  const catInit = useCategoryStore((s) => s.initialized);
  const acctInit = useAccountStore((s) => s.initialized);
  const dataInitialized = catInit && acctInit;

  // 初始化认证
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // 认证完成后才拉取数据
  useEffect(() => {
    if (user && authInitialized) {
      fetchCategories();
      fetchAccounts();
      fetchBudgets();
    }
  }, [user, authInitialized, fetchCategories, fetchAccounts, fetchBudgets]);

  // 首次加载显示全屏 loading（认证初始化 或 数据加载中）
  if (!authInitialized || authLoading) {
    return (
      <Spin size="large" tip="加载中..." spinning>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }} />
      </Spin>
    );
  }

  // 已登录但数据未初始化
  if (user && !dataInitialized) {
    return (
      <Spin size="large" tip="正在加载数据..." spinning>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }} />
      </Spin>
    );
  }

  return (
    <SyncProvider>
      <HashRouter>
        <Routes>
          {/* 登录页 — 无需认证 */}
          <Route path="/login" element={<LoginPage />} />

          {/* 受保护的路由 */}
          <Route
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/mobile-record" element={<MobileRecordPage />} />
            <Route path="/transactions" element={<RecordPage />} />
            <Route path="/report" element={<StatisticsPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/budgets" element={<MobileBudgetPage />} />
            <Route path="/ai-chat" element={<AIChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/membership" element={<MembershipPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </SyncProvider>
  );
}
