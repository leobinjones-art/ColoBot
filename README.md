# NexusMind

<div align="center">

**TypeScript AI Agent Framework with Built-in Security Guardian**

Multi-modal AI × Security Parent Agent × Charter License System

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-18+-green.svg)](https://nodejs.org/)

</div>

---

## 简介

NexusMind 是一个**自带安全守护的 TypeScript AI Agent 框架**。

它将"个人助理"概念转变为可编程、可扩展的模块化系统，采用**业界首创的独立安全母 Agent** 和 **Charter 许可证系统**。

你可以快速构建一个管理待办、写论文、写代码的智能助理——**再也不用担心它说出不该说的话**。

---

## 更名说明

**2025年5月**: 项目从 `ColoBot` 更名为 `NexusMind`

- GitHub 仓库: https://github.com/leobinjones-art/NexusMind
- npm 包: `@nexusmind/*` 和 `nexusmind`

旧包名 `@colo-bot/*` 和 `colobot` 已弃用，请使用新包名。

---

## 核心架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         应用层                                   │
│  frontend (Vue 3)  │  tui (终端UI)  │  server (API服务)         │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         安全层                                   │
│  sentinel - 独立安全守护，平行链路，不参与业务逻辑               │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         许可层                                   │
│  charter - 许可证系统，定义AI能力边界，绑定文档库防幻觉          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         运行时层                                 │
│  core - Agent运行时、LLM调用、工具执行、子Agent管理              │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         基础层                                   │
│  types - 共享类型定义，零依赖                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 安装

```bash
# 核心框架
npm install nexusmind

# 个人助理模块（可选）
npm install @nexusmind/assistant

# Web 前端（可选）
npm install @nexusmind/frontend
```

---

## 快速开始

```typescript
import { AgentRuntime, Sentinel, CharterManager } from 'nexusmind'

// 创建 Agent 运行时
const runtime = new AgentRuntime({
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
})

// 启用安全守护
const sentinel = new Sentinel({
  enableInputScan: true,
  enableOutputScan: true,
})

// 申请许可证解锁能力
const charter = new CharterManager()
await charter.apply('academic', '论文写作')
```

---

## 包结构

| 包 | 说明 |
|---|---|
| `nexusmind` | 伞包，包含核心功能 |
| `@nexusmind/types` | 共享类型定义 |
| `@nexusmind/core` | Agent 运行时核心 |
| `@nexusmind/sentinel` | 安全守护 |
| `@nexusmind/charter` | 许可证系统 |
| `@nexusmind/tui` | 终端 UI |
| `@nexusmind/assistant` | 个人助理模块 |
| `@nexusmind/frontend` | Web 前端 |

---

## 许可证

[AGPL-3.0](LICENSE)
