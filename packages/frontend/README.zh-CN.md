# @colobot/frontend

ColoBot 前端 — 普通用户的 AI 伙伴

---

## 特点

- **零概念** — 不需要知道 Agent/Provider/SOP 等技术术语
- **零配置** — 没有配置文件，所有设置通过界面完成
- **隐私优先** — 数据只存在你的设备上

---

## 功能

### 核心功能

| 功能 | 说明 |
|------|------|
| 对话 | 和 AI 聊天，AI 会记住你说过的话 |
| 自动化 | 每天提醒待办、心情不好时关心你、每周总结 |
| 安全保护 | 自动过滤敏感信息，防止泄露 |
| 个人助理 | 待办、习惯、心情、目标、财务等 |

### 设置

| 设置 | 选项 |
|------|------|
| AI 行为 | 简洁/标准/详细、被动/问候/关心 |
| 心理健康 | 心情追踪、低落时关心、提醒联系朋友 |
| 隐私 | 查看AI记住的事、导出数据、清除数据 |

---

## 开发

### 开发环境

```bash
cd packages/frontend

# 安装依赖
npm install

# 启动 mock API（模拟后端）
npx tsx mock-server.ts

# 启动前端开发服务器
npx vite
```

访问 http://localhost:5173

### 构建

```bash
npm run build
```

### 目录结构

```
packages/frontend/
├── src/
│   ├── views/           # 页面
│   │   ├── Home.vue           # 首页
│   │   ├── ChatConsole.vue    # 对话
│   │   ├── Agents.vue         # AI 助手
│   │   ├── Skills.vue         # 自动化
│   │   ├── Sentinel.vue       # 安全保护
│   │   ├── Onboarding.vue     # 引导流程
│   │   ├── Settings/          # 设置
│   │   └── Assistant/         # 个人助理模块
│   ├── components/      # 组件
│   ├── api/             # API
│   ├── stores/          # 状态
│   └── i18n/            # 国际化
├── mock-server.ts       # Mock API
└── dist/                # 构建输出
```

---

## 技术栈

- Vue 3 + TypeScript
- Vite
- Pinia
- Vue Router
- ECharts
- SSE 流式响应

---

## 后端依赖

生产环境需要部署 ColoBot 后端：

| 包 | 用途 |
|---|------|
| `@colobot/core` | 核心运行时、LLM 调用 |
| `@colobot/sentinel` | 安全守护 |
| `@colobot/assistant` | 个人助理功能 |

开发时可用 mock-server 模拟。

---

## 相关文档

- [隐私政策](../../PRIVACY.md)
- [心理健康干预规划](../../docs/mental-health-intervention.md)
