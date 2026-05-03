# ColoBot

<div align="center">

**内置安全守护的 TypeScript AI Agent 框架**

多模态 AI × 安全父智能体 × 个人助理

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-18+-green.svg)](https://nodejs.org/)

</div>

---

## 简介

ColoBot 是一个**内置安全守护的 TypeScript AI Agent 框架**。

将"个人助理"概念转化为可编程、可扩展的模块化系统，首创**独立安全父智能体**架构。

---

## 设计理念

ColoBot 不是让 AI 听起来更像人，而是让 AI 更像一个关心你的朋友——并且始终尊重你。

这种"人性化"通过**架构**实现——实时评估、隐私边界、安全父智能体、渐进式自主权。

---

## 为什么选择 ColoBot

| 问题 | 解决方案 |
|------|----------|
| **不可绕过的安全** | 独立安全父智能体守护所有消息 |
| **可复用知识** | SOP 将复杂工作流封装为可共享模块 |
| **模块化核心** | 18 个个人助理模块开箱即用 |

---

## 包结构

```
colobot/
├── packages/
│   ├── types/           # 类型定义
│   ├── sentinel/        # 安全守护
│   ├── core/            # 核心运行时
│   ├── assistant/       # 个人助理模块
│   ├── tui/             # 终端 UI
│   ├── frontend/        # Vue 3 Web UI
│   ├── sop-base/        # SOP 流程引擎基类
│   └── sop-academic/    # 学术研究 SOP
└── _legacy/             # 旧代码
```

---

## 快速开始

```bash
# 克隆
git clone https://github.com/your-repo/colobot.git
cd colobot

# 安装
npm install

# 构建
npm run build:packages

# 运行 CLI
npx colobot

# 运行 TUI
npx colobot tui
```

---

## 核心功能

### 🛡️ 安全守护 (@colobot/sentinel)

独立安全父智能体，并行链架构：

- 输入/输出扫描（Trie 树、正则、<1ms）
- 心跳监控（2 秒间隔）
- 状态同步
- 超时处理（30s 警告 → 60s 询问 → 120s 接管）
- 三层防御：规则引擎 → 本地模型 → LLM 接管

### 🤖 Agent 核心 (@colobot/core)

- 多 Provider：OpenAI / Anthropic / MiniMax
- 降级链
- SSE 流式响应
- 上下文压缩
- 子智能体池
- 工具白名单

### 🐍 Python WASM 沙箱

- 无需系统 Python（Pyodide）
- 跨平台
- 安全隔离
- 动态安装包（numpy、pandas 等）

### 📋 个人助理 (@colobot/assistant)

18 个模块：待办、提醒、日历、笔记、习惯、心情、财务、健康、学习、阅读、目标、联系人、项目、密码管理、时间追踪、书签、意图识别、用户画像

### 🖥️ Web UI (@colobot/frontend)

Vue 3 + TypeScript 界面：

- 对话控制台（SSE 流式）
- 智能体/技能管理
- Sentinel 仪表盘
- 所有助理模块
- 成就系统（动画效果）
- 心情热力图
- 命令面板（⌘K）

---

## 开发

```bash
# 构建全部
npm run build:packages

# 构建单个
npm run build --workspace=packages/core

# 测试
npm test

# 类型检查
npx tsc --noEmit
```

### 前端开发

```bash
cd packages/frontend
npm install

# 模拟 API
npx tsx mock-server.ts

# 开发服务器
npm run dev
```

---

## SOP 生态

```
@colobot/sop-base       # 流程引擎基类（官方）
@colobot/sop-academic   # 学术研究流程（官方）
colobot-sop-*           # 社区贡献
```

---

## 项目统计

| 指标 | 数值 |
|------|------|
| 版本 | 0.3.1 |
| 代码 | ~28,500 行 |
| 文件 | 146 |
| 包 | 8 |
| 模块 | 18 |
| 测试 | 522 |
| 覆盖率 | 56%+ |

---

## 许可证

[AGPL-3.0](LICENSE)

---

## English Docs

[View English README](./README.md)