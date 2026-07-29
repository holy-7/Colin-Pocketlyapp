import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/stores/authStore';
import type { ReactNode } from 'react';

// ============================================================
// AuthGuard — 路由守卫
// 未登录 → 重定向到 /login
// 初始化中 → 全屏加载
// 已登录 → 渲染子组件
// ============================================================

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const initialized = useAuthStore((s) => s.initialized);
  const user = useAuthStore((s) => s.user);

  // 认证初始化中
  if (!initialized) {
    return (
      <Spin size="large" tip="加载中..." spinning>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }} />
      </Spin>
    );
  }

  // 未登录
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 已登录
  return <>{children}</>;
}
