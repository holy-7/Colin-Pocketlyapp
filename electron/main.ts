import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';

// 判断是否为开发模式
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

// ===== 自动更新配置（仅生产模式） =====
if (!isDev) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Colin记账',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发模式加载 Vite 开发服务器
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // 生产模式加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

    // 启动后延迟检查更新（不阻塞启动）
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.log('[autoUpdater] 检查更新失败:', err.message);
      });
    }, 5000);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ===== IPC Handlers: 自动更新 =====
ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    return { dev: true };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return result ? { result: 'checked' } : { result: 'no-update' };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { result: 'downloaded' };
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

// ===== 注册 autoUpdater 事件 → 转发给渲染进程 =====
function sendToRenderer(channel: string, data?: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

autoUpdater.on('update-available', (info) => {
  sendToRenderer('update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
  sendToRenderer('update-not-available', info);
});

autoUpdater.on('download-progress', (progress) => {
  sendToRenderer('download-progress', progress);
});

autoUpdater.on('update-downloaded', (info) => {
  sendToRenderer('update-downloaded', info);
});

autoUpdater.on('error', (err) => {
  sendToRenderer('update-error', err.message);
});

// ===== 应用生命周期 =====
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
