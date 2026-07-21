import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的 API 给渲染进程
// MVP-1：supabase-js 直接在渲染进程中调用，无需 IPC 桥接
// preload 保留给后续扩展使用（如文件系统操作、系统通知等）
contextBridge.exposeInMainWorld('electronAPI', {
  // 平台信息
  platform: process.platform,
  // 预留：后续可在此添加 IPC 通道
  send: (channel: string, data: unknown) => {
    const validChannels = ['export-data', 'import-data'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel: string, func: (...args: unknown[]) => void) => {
    const validChannels = ['export-complete', 'import-complete'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  },
});
