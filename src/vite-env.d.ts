/// <reference types="vite/client" />

interface UpdateInfo {
  version: string;
  releaseDate?: string;
}

interface ElectronAPI {
  platform: string;
  send: (channel: string, data: unknown) => void;
  on: (channel: string, func: (...args: unknown[]) => void) => void;
  // 自动更新
  onUpdateAvailable: (cb: (info: UpdateInfo) => void) => void;
  onUpdateNotAvailable: (cb: (info: UpdateInfo) => void) => void;
  onDownloadProgress: (cb: (progress: { percent: number }) => void) => void;
  onUpdateDownloaded: (cb: (info: UpdateInfo) => void) => void;
  onUpdateError: (cb: (msg: string) => void) => void;
  checkForUpdates: () => Promise<unknown>;
  downloadUpdate: () => Promise<unknown>;
  quitAndInstall: () => void;
  getVersion: () => Promise<string>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
