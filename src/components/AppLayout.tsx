import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Drawer, Button } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import {
  HomeOutlined,
  UnorderedListOutlined,
  PieChartOutlined,
  CompassOutlined,
  SettingOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useResponsive } from '@/hooks/useResponsive';
import BottomTabBar from '@/components/BottomTabBar';
import SyncStatusBar from '@/components/SyncStatusBar';
import MobileSplash from '@/components/MobileSplash';

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '记账' },
  { key: '/transactions', icon: <UnorderedListOutlined />, label: '明细' },
  { key: '/report', icon: <PieChartOutlined />, label: '图表' },
  { key: '/discover', icon: <CompassOutlined />, label: '发现' },
  { key: '/ai-chat', icon: <RobotOutlined />, label: 'AI助手' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

function getSelectedKey(pathname: string): string {
  const currentKey = '/' + pathname.split('/').filter(Boolean)[0] || '/';
  return (
    menuItems
      .filter((item) => currentKey.startsWith(item.key))
      .sort((a, b) => b.key.length - a.key.length)[0]?.key || '/'
  );
}

// ==================== Desktop Layout ====================

function DesktopLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedKey = getSelectedKey(location.pathname);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={200} style={{ borderRight: '1px solid #f0f0f0' }}>
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
            padding: '4px 12px',
            overflow: 'visible',
          }}
        >
          <img
            src="./logo.svg"
            alt="Colin记账"
            style={{
              height: 252,
              objectFit: 'contain',
            }}
          />
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          {menuItems.find((m) => m.key === selectedKey)?.label || 'Colin记账'}
          <SyncStatusBar />
        </Header>
        <Content style={{ margin: 16, padding: 24, background: '#fff', borderRadius: 8, overflowY: 'auto', overflowX: 'hidden' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

// ==================== Mobile Layout ====================

function MobileLayout() {
  const location = useLocation();
  const [splashDone, setSplashDone] = useState(false);

  // 记账页隐藏底部 TabBar（匹配原型设计）
  const hideTabBar = location.pathname === '/mobile-record';

  if (!splashDone) {
    return <MobileSplash onComplete={() => setSplashDone(true)} />;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
        background: '#F5F5F5',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', width: '100%' }}>
        <Outlet />
      </div>
      {!hideTabBar && <BottomTabBar />}
    </div>
  );
}

// ==================== AppLayout (adaptive) ====================

export default function AppLayout() {
  const { isMobile } = useResponsive();

  // 平板端暂时使用桌面端布局（侧边栏本身支持折叠）
  if (isMobile) {
    return <MobileLayout />;
  }
  return <DesktopLayout />;
}
