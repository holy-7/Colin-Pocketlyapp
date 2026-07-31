import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Progress, Space, App } from 'antd';
import {
  DownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

interface UpdateInfo {
  version: string;
  releaseDate?: string;
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'no-update';

export default function UpdateNotification() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const { message } = App.useApp();

  const api = window.electronAPI;

  // 监听主进程推送的更新事件
  useEffect(() => {
    if (!api) return;

    api.onUpdateAvailable((info: UpdateInfo) => {
      setUpdateInfo(info);
      setStatus('available');
      setModalVisible(true);
    });

    api.onUpdateNotAvailable(() => {
      // 仅在手动检查时通知
      if (status === 'checking') {
        setStatus('no-update');
        message.info('当前已是最新版本');
        setStatus('idle');
      }
    });

    api.onDownloadProgress((progress: { percent: number }) => {
      setStatus('downloading');
      setDownloadPercent(Math.round(progress.percent));
    });

    api.onUpdateDownloaded((info: UpdateInfo) => {
      setUpdateInfo((prev) => info || prev);
      setStatus('downloaded');
      setDownloadPercent(100);
    });

    api.onUpdateError((msg: string) => {
      setErrorMsg(msg);
      setStatus('error');
      setModalVisible(true);
    });

    return () => {
      // Electron IPC listeners are cleaned up automatically when window closes
    };
  }, [api, status, message]);

  // 手动检查更新（从设置页调用）
  const handleCheckUpdates = useCallback(async () => {
    if (!api) return;
    setStatus('checking');
    try {
      const result = await api.checkForUpdates();
      if (result && (result as any).dev) {
        message.info('开发模式，跳过更新检查');
        setStatus('idle');
      }
    } catch {
      // 错误通过 onUpdateError 事件处理
    }
  }, [api, message]);

  // 下载更新
  const handleDownload = useCallback(async () => {
    if (!api) return;
    setStatus('downloading');
    setDownloadPercent(0);
    try {
      await api.downloadUpdate();
    } catch {
      // 错误通过 onUpdateError 事件处理
    }
  }, [api]);

  // 重启安装
  const handleInstall = useCallback(() => {
    if (!api) return;
    api.quitAndInstall();
  }, [api]);

  // 暴露给外部使用（设置页调用 handleCheckUpdates）
  // 通过 ref 模式暴露 — 但这里用更简单的方式：直接在 window 上挂载
  useEffect(() => {
    (window as any).__checkForUpdates = handleCheckUpdates;
    return () => {
      delete (window as any).__checkForUpdates;
    };
  }, [handleCheckUpdates]);

  // PWA / 非 Electron 环境不渲染
  if (!api) return null;

  return (
    <Modal
      title={
        status === 'available'
          ? '发现新版本'
          : status === 'downloading'
          ? '正在下载更新...'
          : status === 'downloaded'
          ? '更新已就绪'
          : status === 'error'
          ? '更新失败'
          : '检查更新'
      }
      open={modalVisible}
      onCancel={() => {
        if (status !== 'downloading') {
          setModalVisible(false);
          if (status === 'error') setStatus('idle');
        }
      }}
      closable={status !== 'downloading'}
      maskClosable={status !== 'downloading'}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {status === 'available' && (
            <Space>
              <Button onClick={() => setModalVisible(false)}>稍后再说</Button>
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
                立即更新
              </Button>
            </Space>
          )}
          {status === 'downloading' && (
            <Button disabled>下载中...</Button>
          )}
          {status === 'downloaded' && (
            <Button type="primary" icon={<ReloadOutlined />} onClick={handleInstall}>
              立即重启
            </Button>
          )}
          {status === 'error' && (
            <Space>
              <Button onClick={() => setModalVisible(false)}>关闭</Button>
              <Button type="primary" icon={<ReloadOutlined />} onClick={handleCheckUpdates}>
                重试
              </Button>
            </Space>
          )}
        </div>
      }
    >
      {status === 'available' && updateInfo && (
        <div style={{ padding: '16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ExclamationCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
            <span style={{ fontSize: 15, fontWeight: 500 }}>
              新版本 {updateInfo.version} 已发布
            </span>
          </div>
          {updateInfo.releaseDate && (
            <p style={{ color: '#666', fontSize: 13, margin: 0 }}>
              发布日期: {new Date(updateInfo.releaseDate).toLocaleDateString('zh-CN')}
            </p>
          )}
          <p style={{ color: '#666', fontSize: 13, marginTop: 8 }}>
            是否下载并安装更新？
          </p>
        </div>
      )}

      {status === 'downloading' && (
        <div style={{ padding: '16px 0', textAlign: 'center' }}>
          <Progress type="circle" percent={downloadPercent} size={100} />
          <p style={{ marginTop: 12, color: '#666', fontSize: 13 }}>
            下载进度: {downloadPercent}%
          </p>
        </div>
      )}

      {status === 'downloaded' && (
        <div style={{ padding: '16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            <span style={{ fontSize: 15, fontWeight: 500 }}>更新包已下载完成</span>
          </div>
          <p style={{ color: '#666', fontSize: 13 }}>
            点击"立即重启"以安装更新，应用将自动重启。
          </p>
        </div>
      )}

      {status === 'error' && (
        <div style={{ padding: '16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
            <span style={{ fontSize: 15, fontWeight: 500, color: '#ff4d4f' }}>更新出错</span>
          </div>
          <p style={{ color: '#666', fontSize: 13 }}>{errorMsg || '请检查网络连接后重试'}</p>
        </div>
      )}
    </Modal>
  );
}
