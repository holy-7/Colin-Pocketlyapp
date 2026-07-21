/// <reference types="vite/client" />

interface ElectronAPI {
  platform: string;
  send: (channel: string, data: unknown) => void;
  on: (channel: string, func: (...args: unknown[]) => void) => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
