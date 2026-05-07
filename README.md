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

## 核心特性

### 🛡️ 安全守护 (Sentinel)

**独立安全层**，永不参与业务逻辑：

```typescript
import { Sentinel, CharterGuard } from '@nexusmind/sentinel'

const sentinel = new Sentinel()
const guard = new CharterGuard()

// 输入扫描 (< 1ms)
const result = sentinel.scanInput(userMessage)

// 许可证权限检查
const capResult = guard.checkCapability(userId, 'paper-writing')
```

### 📜 许可证系统 (Charter)

**定义 AI 能力边界**：

```typescript
import { CharterManager } from '@nexusmind/charter'

const manager = new CharterManager()

// 申请许可证
const instance = manager.requestCharter(userId, {
  type: 'academic',
  reason: '论文写作'
})

// 检查能力
const result = manager.checkCapability(userId, 'paper-writing')
if (result.allowed) {
  // 获取相关文档库条目（防止幻觉）
  const library = manager.getCharterLibrary(result.charter.charterId)
}
```

**内置许可证**：
- `academic` - 论文写作、文献综述、引用格式化
- `legal` - 合同起草、免责声明、法律分析
- `longdoc` - 长文档处理、分区处理

### 🤖 多 LLM 支持

```typescript
import { OpenAIProvider, AnthropicProvider, MiniMaxProvider } from '@nexusmind/core'

const provider = new OpenAIProvider({ apiKey: 'your-key' })
// 或
const provider = new AnthropicProvider({ apiKey: 'your-key' })
```

### 🐍 Python WASM 沙箱

无需系统 Python，跨平台安全执行：

```typescript
const result = await toolRegistry.get('python')!.execute({
  code: `
import numpy as np
arr = np.array([1, 2, 3])
print(arr.sum())
  `,
  packages: ['numpy'],
})
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
import { AgentRuntime, Sentinel, CharterManager, SQLiteStore } from 'nexusmind'

// 创建运行时
const runtime = new AgentRuntime({
  llm: new OpenAIProvider({ apiKey: 'your-key' }),
  memory: new SQLiteStore({ path: '~/.nexusmind/chat.db' }),
})

// 启用安全守护
const sentinel = new Sentinel({
  enableInputScan: true,
  enableOutputScan: true,
})

// 运行
const result = await runtime.run({
  agentId: 'my-agent',
  userMessage: '你好',
})
```

### CLI 使用

```bash
# 交互式配置
npx nexusmind init

# 终端 UI
npx nexusmind tui

# 直接对话
npx nexusmind
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

## 个人助理模块

`@nexusmind/assistant` 提供 18 个模块：

| 模块 | 功能 |
|---|---|
| **Todo** | 待办事项、优先级、标签 |
| **Reminders** | 定时提醒、自然语言创建 |
| **Calendar** | 日历视图、冲突检测 |
| **Notes** | Markdown 笔记、全文搜索 |
| **Habits** | 习惯追踪、连续打卡 |
| **Moods** | 心情日记、趋势分析 |
| **Finance** | 收支记录、分类统计 |
| **Health** | 运动、睡眠、体重、饮水 |
| **Goals** | 目标设定、进度追踪 |
| **Contacts** | 人脉管理 |
| **Projects** | 项目管理 |
| **Knowledge** | 知识库、书签 |
| **Intent** | 自然语言意图识别 |

---

## 安全守护特性

| 特性 | 说明 |
|---|---|
| **输入扫描** | Trie 树敏感词、正则模式、长度限制，< 1ms 响应 |
| **输出扫描** | 异步检测，先投递后撤回 |
| **心跳监控** | 2 秒间隔，3 次丢失 = 死亡 |
| **状态同步** | 实时主 Agent 状态同步 |
| **超时处理** | 30s 警告 → 60s 询问 → 120s 接管 |
| **三层防御** | 规则引擎 → 本地模型 → LLM 接管 |
| **分布式** | Redis 共享状态、Pub/Sub 信号 |

---

## 开发

```bash
# 克隆仓库
git clone https://github.com/leobinjones-art/NexusMind.git
cd NexusMind

# 安装依赖
npm install

# 构建
npm run build:packages

# 测试
npm test
```

---

## 项目统计

| 指标 | 数值 |
|---|---|
| 版本 | 0.4.0 |
| 代码行数 | ~28,500 行 TypeScript |
| 源文件 | 146 |
| 包数量 | 8 |
| 助理模块 | 18 |
| 测试用例 | 587 |

---

## 许可证

[AGPL-3.0](LICENSE)

---

## 致谢

- [OpenAI](https://openai.com/)
- [Anthropic](https://www.anthropic.com/)
- [Pyodide](https://pyodide.org/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [llm-guard](https://github.com/protectai/llm-guard)
