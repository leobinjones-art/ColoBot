# @colobot/frontend

ColoBot Vue 3 前端应用 — 面向普通用户的 AI 伙伴界面

---

## 当前状态

基于 Vue 3 + TypeScript + Vite 的 Web 应用，提供：

- **对话控制台** — SSE 流式对话、工具调用可视化、用户画像上下文
- **智能体管理** — 创建和配置 AI 智能体
- **个人助理** — 待办、习惯、情绪、财务等 8 个模块
- **安全守护** — Sentinel 状态监控
- **系统设置** — 模型配置、功能开关

### 技术栈

- Vue 3 + Composition API
- TypeScript 5.6
- Vite 6
- Pinia 状态管理
- Vue Router 4
- ECharts 图表
- SSE 流式响应
- highlight.js + DOMPurify

---

## 发展方向：普通用户版

> 详细规划见 [docs/consumer-version-roadmap.md](../../docs/consumer-version-roadmap.md)

### 目标

把 ColoBot 的架构能力封装成普通用户能理解的产品：

- **零概念** — 用户不需要知道 Agent/Tool/Provider
- **零配置** — 默认值即最优，高级选项折叠
- **零部署** — 桌面应用，下载即用

### 核心差异化

| 维度 | LLM 演示产品 | ColoBot 普通用户版 |
|------|-------------|-------------------|
| 记忆 | 每次从头开始 | 长期记忆，越用越懂你 |
| 主动性 | 等你提问 | 主动关心你的状态 |
| 安全感 | 黑盒承诺 | 可查看、可控制、可审计 |
| 定制性 | 选预设角色 | 开关式定制行为 |

### 功能优先级

**P0：核心体验闭环**

| 功能 | 状态 |
|------|------|
| 引导式初始设置 | 📋 规划中 |
| 基础对话 | ✅ 已实现 |
| 长期记忆 | ✅ 已实现（用户画像） |
| 安全日志 | 📋 规划中 |
| 行为开关 | 📋 规划中 |

**P1：差异化体验**

| 功能 | 状态 |
|------|------|
| 轻度主动问候 | 📋 规划中 |
| 情绪日记 | ✅ 已实现（Moods 页面） |
| 数据导出/删除 | 📋 规划中 |
| 端到端加密同步 | 📋 规划中 |

**P2：生态扩展**

| 功能 | 状态 |
|------|------|
| 插件市场 | 📋 规划中 |
| 深度主动关心 | 📋 规划中（见心理健康干预规划） |
| Web 版 | ✅ 已实现 |

---

## 开发指南

### 开发环境

```bash
cd packages/frontend

# 安装依赖
npm install

# 启动开发服务器（需要 mock API）
npm run dev

# 启动 mock API 服务器
npx tsx mock-server.ts

# 构建
npm run build
```

### 目录结构

```
packages/frontend/
├── src/
│   ├── views/           # 页面组件
│   │   ├── ChatConsole.vue    # 对话控制台
│   │   ├── Agents.vue         # 智能体管理
│   │   ├── Assistant/         # 个人助理模块
│   │   ├── Settings/          # 设置页面
│   │   └── layout/            # 布局组件
│   ├── components/
│   │   ├── chat/        # 对话相关组件
│   │   ├── settings/    # 设置相关组件
│   │   └── common/      # 通用组件
│   ├── api/             # API 模块
│   ├── stores/          # Pinia stores
│   ├── composables/     # 组合式函数
│   ├── types/           # TypeScript 类型
│   ├── utils/           # 工具函数
│   └── i18n/            # 国际化
├── mock-server.ts       # Mock API 服务器
└── dist/                # 构建输出
```

### 创意组件

- `StreamProgress` — 流式响应阶段可视化
- `ToolCallCard` — 工具调用展示
- `AchievementToast` — 成就庆祝弹窗（金色光晕、粒子效果）
- `CommandPalette` — 快捷命令面板（⌘K）

---

## 与开发者版的关系

| 开发者版 | 普通用户版（前端） |
|---------|-------------------|
| CLI/TUI | Web/Desktop GUI |
| 配置文件 | 设置界面 |
| CLI 命令 | 界面按钮 |
| `/context` | 数据面板 |
| Sentinel 日志 | 安全日志界面 |

前端复用开发者版核心包：

- `@colobot/core` — 运行时
- `@colobot/sentinel` — 安全守护
- `@colobot/assistant` — 个人助理功能

---

## 发布路线

| 阶段 | 目标 | 依赖 |
|------|------|------|
| Alpha | 技术用户内测 | 开发者版 v0.4 |
| Beta | 非技术用户测试 | Alpha 反馈后 2-4 周 |
| 1.0 | 正式发布 | Beta 稳定后 |

---

## 相关文档

- [心理健康主动干预规划](../../docs/mental-health-intervention.md)
- [普通用户版完整规划](../../docs/consumer-version-roadmap.md)
- [隐私政策](../../PRIVACY.md)
