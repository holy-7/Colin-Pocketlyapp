// Colin记账 — Preload 脚本
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  send: (channel, data) => {
    const validChannels = ['export-data', 'import-data'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, func) => {
    const validChannels = ['export-complete', 'import-complete'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  },

  // ===== 自动更新 API =====
  onUpdateAvailable: (cb) => {
    ipcRenderer.on('update-available', (_event, info) => cb(info));
  },
  onUpdateNotAvailable: (cb) => {
    ipcRenderer.on('update-not-available', (_event, info) => cb(info));
  },
  onDownloadProgress: (cb) => {
    ipcRenderer.on('download-progress', (_event, progress) => cb(progress));
  },
  onUpdateDownloaded: (cb) => {
    ipcRenderer.on('update-downloaded', (_event, info) => cb(info));
  },
  onUpdateError: (cb) => {
    ipcRenderer.on('update-error', (_event, msg) => cb(msg));
  },
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  getVersion: () => ipcRenderer.invoke('get-version'),
});
