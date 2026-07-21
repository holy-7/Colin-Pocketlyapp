import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  HomeOutlined,
  UnorderedListOutlined,
  PieChartOutlined,
  SettingOutlined,
  WalletOutlined,
} from '@ant-design/icons';

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '记账' },
  { key: '/transactions', icon: <UnorderedListOutlined />, label: '明细' },
  { key: '/report', icon: <PieChartOutlined />, label: '图标' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const currentKey = '/' + location.pathname.split('/').filter(Boolean)[0] || '/';
  const selectedKey = menuItems
    .filter((item) => currentKey.startsWith(item.key))
    .sort((a, b) => b.key.length - a.key.length)[0]?.key || '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        width={200}
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <WalletOutlined style={{ fontSize: collapsed ? 20 : 28, color: '#4ECDC4' }} />
          {!collapsed && (
            <span style={{ marginLeft: 8, fontSize: 18, fontWeight: 700, color: '#333' }}>
              Colin记账
            </span>
          )}
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
        </Header>
        <Content style={{ margin: 16, padding: 24, background: '#fff', borderRadius: 8, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
