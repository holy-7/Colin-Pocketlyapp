// Colin记账 — Electron 开发启动脚本
// 同时启动 Vite 开发服务器和 Electron 桌面窗口
//
// 关键：ELECTRON_RUN_AS_NODE=1 会导致 Electron 以纯 Node.js 模式运行，
// 必须在启动 Electron 二进制前移除该环境变量。
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ====== 清除 ELECTRON_RUN_AS_NODE ======
// 这是最关键的一步！否则 Electron 内置模块（app, BrowserWindow）不可用
delete process.env.ELECTRON_RUN_AS_NODE;

const rootDir = path.join(__dirname, '..');
const electronExe = path.join(rootDir, 'node_modules', 'electron', 'dist', 'electron.exe');
// Windows：.bin/vite 是 bash 脚本，需要用 .cmd 或 node 直接运行 vite.js
const viteEntry = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');

console.log('[Colin] 🚀 启动 Colin记账 桌面开发环境');
console.log('[Colin] ELECTRON_RUN_AS_NODE =', process.env.ELECTRON_RUN_AS_NODE || '(已清除)');

// 0. 预检查：Electron 二进制是否存在
if (!fs.existsSync(electronExe)) {
  console.error('[Colin] ❌ 找不到 Electron 可执行文件:');
  console.error('     ' + electronExe);
  console.error('');
  console.error('[Colin] 💡 这通常是中国大陆网络环境下 GitHub 下载失败导致的。');
  console.error('[Colin] 💡 请手动运行以下命令修复:');
  console.error('');
  console.error('     set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/');
  console.error('     node node_modules\\electron\\install.js');
  console.error('');
  console.error('[Colin] 💡 或直接运行: npm run electron:fix');
  process.exit(1);
}

// 1. 编译 Electron TypeScript → dist-electron/
try {
  console.log('[Colin] 🔨 编译 Electron 主进程...');
  execSync('npx tsc -p tsconfig.electron.json', { cwd: rootDir, stdio: 'pipe' });
  console.log('[Colin] ✅ Electron 编译完成');
} catch (err) {
  console.error('[Colin] ❌ Electron 编译失败:', err.message);
  process.exit(1);
}

// 1. 启动 Vite 开发服务器
const viteProcess = spawn('node', [viteEntry], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

// 2. 等待 Vite 就绪后启动 Electron
function waitForVite(retries = 50, interval = 500) {
  let attempts = 0;

  function check() {
    attempts++;
    http.get('http://localhost:5173', (res) => {
      // Vite 已就绪，启动 Electron
      console.log('[Colin] ✅ Vite 就绪，启动 Electron...');
      startElectron();
    }).on('error', () => {
      if (attempts >= retries) {
        console.error('[Colin] ❌ Vite 启动超时，请检查端口 5173');
        viteProcess.kill();
        process.exit(1);
      } else {
        setTimeout(check, interval);
      }
    });
  }

  check();
}

function startElectron() {
  const electronProcess = spawn(electronExe, ['.'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  electronProcess.on('exit', (code) => {
    viteProcess.kill();
    process.exit(code || 0);
  });

  electronProcess.on('error', (err) => {
    console.error('[Colin] ❌ Electron 启动失败:', err.message);
    viteProcess.kill();
    process.exit(1);
  });
}

// 优雅退出
process.on('SIGINT', () => {
  viteProcess.kill();
  process.exit(0);
});
process.on('SIGTERM', () => {
  viteProcess.kill();
  process.exit(0);
});

viteProcess.on('exit', (code) => {
  if (code !== null && code !== 0) {
    console.error('[Colin] Vite 进程异常退出');
    process.exit(code);
  }
});

// 开始等待 Vite
waitForVite();
