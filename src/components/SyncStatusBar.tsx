import { Badge, Tooltip, Space } from 'antd';
import {
  WifiOutlined,
  CloudSyncOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useSyncStatus } from '@/services/syncContext';

export default function SyncStatusBar() {
  const status = useSyncStatus();

  const { isOnline, pendingCount, syncing, hasConflict } = status;

  return (
    <Space size={12} style={{ marginLeft: 'auto' }}>
      {/* 在线/离线状态 */}
      <Tooltip title={isOnline ? '在线' : '离线'}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: isOnline ? '#27AE60' : '#F39C12',
            fontSize: 13,
          }}
        >
          <WifiOutlined />
          <span>{isOnline ? '在线' : '离线'}</span>
        </span>
      </Tooltip>

      {/* 待同步数量 */}
      {pendingCount > 0 && (
        <Tooltip title={`${pendingCount} 笔待同步`}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: '#F39C12',
              fontSize: 13,
            }}
          >
            <CloudSyncOutlined spin={syncing} />
            <span>{pendingCount}笔待同步</span>
          </span>
        </Tooltip>
      )}

      {/* 同步中指示器 */}
      {syncing && pendingCount === 0 && (
        <Tooltip title="同步中...">
          <span style={{ color: '#4ECDC4', fontSize: 13 }}>
            <CloudSyncOutlined spin />
          </span>
        </Tooltip>
      )}

      {/* 冲突指示器 */}
      {hasConflict && (
        <Tooltip title="检测到数据冲突">
          <Badge dot status="error">
            <ExclamationCircleOutlined style={{ color: '#E74C3C', fontSize: 16 }} />
          </Badge>
        </Tooltip>
      )}
    </Space>
  );
}
