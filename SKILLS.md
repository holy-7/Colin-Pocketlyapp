# Colin记账 — SKILLS.md

> Loop Engineering 的 Skills 组件：项目知识的持久化积累。

---

## 技术栈

> ⚠️ 2026-07-20 最终版：Electron 桌面 + Supabase 云端 + 本地 SQLite 缓存。

| 层 | 方案 | 说明 |
|:---|:---|:---|
| 桌面外壳 | **Electron** | 打包为 .exe/.dmg 桌面应用 |
| 界面框架 | **React 18 + Vite + TypeScript** | AI 辅助友好，黑马同方案 |
| UI 组件库 | **Ant Design 5** | 表格/表单/图表组件丰富 |
| 图表库 | **Recharts** | 饼图/折线图/柱状图 |
| 状态管理 | **Zustand** | 轻量无 boilerplate |
| 云服务 | **Supabase**（BaaS） | PostgreSQL + 实时同步 + 开源 |
| 云数据库 | **Supabase PostgreSQL** | 主存储，双端共享 |
| 本地缓存 | **SQLite (sql.js)** | 离线降级，断网时读写本地 |
| 实时同步 | **Supabase Realtime** | WebSocket 订阅，桌面 ↔ APP 秒级一致 |
| 打包 | **electron-builder** | .exe（Win）+ .dmg（Mac） |
| 移动端 | React Native / Flutter（MVP-2） | supabase-js 直接接入 |
| AI 模型 | Claude API / 本地小模型 | V1.0 启用 |

**关键依赖**：
```json
{
  "@supabase/supabase-js": "^2.x",
  "electron": "^28.x",
  "react": "^18.x",
  "antd": "^5.x",
  "recharts": "^2.x",
  "zustand": "^4.x"
}
```

---

## 构建与测试命令

```bash
# 安装依赖
npm install

# 开发模式（启动 Electron + Vite 热更新）
npm run dev

# 运行测试
npm test                     # Vitest

# 运行单个测试
npm test -- -t "test name"

# Lint 检查
npm run lint                 # ESLint

# 打包桌面应用
npm run package:win          # Windows → .exe
npm run package:mac          # Mac → .dmg
```

启动后自动弹出 Electron 窗口，开发服务器运行在 `http://localhost:5173`（参考黑马记账同模式）。

---

## 代码规范

- 使用 TypeScript strict mode
- 函数名 camelCase，组件名 PascalCase
- 禁止 any，必须显式类型
- import 顺序：标准库 → 第三方 → 本地
- 每个文件 ≤ 300 行

---

## 项目目录结构

```
Colin记账/
├── README.md                  # 项目说明
├── SKILLS.md                  # 本文件
├── 需求文档.md                 # 产品需求规约
├── package.json               # 依赖配置
├── electron/                  # Electron 主进程
│   ├── main.ts                # 窗口管理
│   └── preload.ts             # 安全桥接（暴露 supabase client 给渲染进程）
├── src/                       # React 渲染进程（界面）
│   ├── App.tsx                # 应用入口与路由
│   ├── lib/                   # supabase-js 客户端初始化
│   │   └── supabase.ts        # createClient(url, anonKey) + Realtime 配置
│   ├── pages/                 # 页面（同黑马 5 页面模式）
│   │   ├── HomePage.tsx       # 首页仪表盘/记账
│   │   ├── RecordPage.tsx     # 交易记录列表
│   │   ├── StatisticsPage.tsx # 统计报表
│   │   ├── CategoryPage.tsx   # 分类管理
│   │   └── SettingsPage.tsx   # 设置（预算/导出）
│   ├── components/            # 可复用组件
│   ├── stores/                # Zustand 状态管理（从 supabase 读取）
│   ├── database/              # 本地 SQLite 缓存层（离线降级）
│   └── types/                 # TypeScript 类型定义（同步自 Supabase schema）
└── resources/                 # 应用图标等资源
```

**数据流**：
```
在线：React → Zustand → supabase-js → Supabase PostgreSQL ← Realtime → Zustand → React
离线：React → Zustand → sql.js（本地缓存）→ 联网后 supaBase.upsert() 增量同步
```

---

## 数据模型（与需求文档对齐）

```
Account  →  Transaction  ←  Category
                       ←  Tag
          Budget
```

---

## 已知坑

> 每遇到一个问题并解决后，在此记录。避免下次重新踩坑。

### 暂无（项目刚开始）

---

## 业务上下文

- 这是个人记账应用，自用优先
- MVP-1 单用户，无注册登录
- 核心流程：记一笔 → 看列表 → 看报表
- AI 助手 V1.0 才加入，MVP 阶段不碰 LLM

---

*此文件随开发持续更新。每个 Loop 结束后，新学到的规则必须写入。*
