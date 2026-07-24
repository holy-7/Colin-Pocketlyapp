import { useNavigate, useLocation } from 'react-router-dom';

const tabs = [
  {
    key: '/',
    label: '明细',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
      </svg>
    ),
    isRecord: false,
  },
  {
    key: '/report',
    label: '图表',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
      </svg>
    ),
    isRecord: false,
  },
  {
    key: '/mobile-record',
    label: '记账',
    icon: null,
    isRecord: true,
  },
  {
    key: '/discover',
    label: '发现',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    ),
    isRecord: false,
  },
  {
    key: '/settings',
    label: '我的',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    ),
    isRecord: false,
  },
];

export default function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = '/' + location.pathname.split('/').filter(Boolean)[0] || '/';
  const activeKey =
    tabs
      .filter((t) => currentPath.startsWith(t.key))
      .sort((a, b) => b.key.length - a.key.length)[0]?.key || '/';

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        height: 70,
        background: '#fff',
        borderTop: '1px solid #eee',
        paddingTop: 6,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;

        if (tab.isRecord) {
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                color: '#999',
                fontSize: 11,
                cursor: 'pointer',
                padding: '0 10px',
                border: 'none',
                background: 'none',
                marginTop: -18,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  background: '#FFD93D',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(255, 217, 61, 0.4)',
                  color: '#333',
                }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
              </div>
              <span>{tab.label}</span>
            </button>
          );
        }

        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              color: isActive ? '#333' : '#999',
              fontSize: 11,
              cursor: 'pointer',
              padding: '0 10px',
              border: 'none',
              background: 'none',
              transition: 'color 0.2s',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
