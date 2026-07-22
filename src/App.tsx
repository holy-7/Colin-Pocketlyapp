import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Spin } from 'antd';
import AppLayout from '@/components/AppLayout';
import HomePage from '@/pages/HomePage';
import RecordPage from '@/pages/RecordPage';
import StatisticsPage from '@/pages/StatisticsPage';
import DiscoverPage from '@/pages/DiscoverPage';
import SettingsPage from '@/pages/SettingsPage';
import { useCategoryStore } from '@/stores/categoryStore';
import { useAccountStore } from '@/stores/accountStore';
import { useBudgetStore } from '@/stores/budgetStore';

export default function App() {
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const fetchAccounts = useAccountStore((s) => s.fetchAccounts);
  const fetchBudgets = useBudgetStore((s) => s.fetchBudgets);
  const catInit = useCategoryStore((s) => s.initialized);
  const acctInit = useAccountStore((s) => s.initialized);
  const initialized = catInit && acctInit;

  useEffect(() => {
    fetchCategories();
    fetchAccounts();
    fetchBudgets();
  }, [fetchCategories, fetchAccounts, fetchBudgets]);

  // 仅首次加载显示全屏 loading，后续页面切换不再阻断
  if (!initialized) {
    return (
      <Spin size="large" tip="加载中..." spinning>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }} />
      </Spin>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/transactions" element={<RecordPage />} />
          <Route path="/report" element={<StatisticsPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
