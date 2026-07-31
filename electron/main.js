// Colin记账 — Electron 主进程
// 注意：不要在本文件中 require('electron') npm 包！
// Electron 运行时内置的 electron 模块会被 node_modules/electron 遮蔽。
// 解决办法：从 node_modules 中移除 npm electron 包后启动。
const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

const isDev = !app.isPackaged;

let mainWindow = null;

// ===== 自动更新配置（仅生产模式） =====
if (!isDev) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ===== 注册 autoUpdater 事件 → 转发给渲染进程 =====
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

// ===== IPC Handlers: 自动更新 =====
ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    return { dev: true };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return result ? { result: 'checked' } : { result: 'no-update' };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { result: 'downloaded' };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
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
