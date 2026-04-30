# ColoBot

<div align="center">

**单智能体 + 子智能体协作平台**

多模态 AI × Skill 编排 × 个人助理

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-18+-green.svg)](https://nodejs.org/)

</div>

---

## 简介

ColoBot 是一个基于 TypeScript 的 AI Agent 框架，专注于**个人助理**场景。支持多模态交互、子 Agent 协作、工具调用，并内置完整的个人信息管理功能。

### 核心特点

- 🤖 **多 LLM 支持**: OpenAI、Anthropic、MiniMax、自定义 API
- 🛡️ **安全守护**: 独立的安全母 Agent，输入输出扫描、进程守护、异常接管
- 🧠 **子 Agent 协作**: 任务分解、并行执行、工具白名单
- 🖼️ **多模态**: 文本、图片、音频
- 🐍 **Python WASM**: Pyodide 沙箱执行，无需系统 Python
- 📋 **个人助理**: 待办、提醒、日程、笔记、习惯追踪等 18 个模块
- 🔧 **工具系统**: 内置 20+ 工具，支持自定义扩展
- 💾 **记忆系统**: SQLite/PostgreSQL 持久化，向量搜索

---

## 包结构

```
colobot/
├── packages/
│   ├── types/           # 类型定义
│   ├── sentinel/        # 安全守护母 Agent
│   │   ├── rule-engine/ # 规则引擎（Trie树敏感词）
│   │   ├── heartbeat/   # 心跳协议
│   │   ├── state/       # 状态同步
│   │   ├── signal/      # 接管信号
│   │   └── redis/       # 分布式支持
│   ├── core/            # 核心运行时
│   │   ├── providers/   # LLM Provider
│   │   ├── runtime/     # Agent 运行时
│   │   ├── memory/      # 记忆系统
│   │   ├── tools/       # 工具系统（含 Python WASM）
│   │   ├── subagents/   # 子 Agent
│   │   └── config/      # 配置管理
│   ├── assistant/       # 核心助理
│   │   ├── task/        # 待办、提醒
│   │   ├── schedule/    # 日程
│   │   ├── knowledge/   # 笔记、收藏
│   │   ├── life/        # 习惯、心情、财务、健康
│   │   ├── growth/      # 学习、阅读、目标
│   │   ├── social/      # 人脉
│   │   ├── project/     # 项目
│   │   └── tools/       # 密码、时间追踪
│   ├── tui/             # 终端界面
│   ├── sop-base/        # SOP 基础接口
│   └── sop-academic/    # 学术 SOP
└── _legacy/             # 旧代码（待迁移）
```

---

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-repo/colobot.git
cd colobot

# 安装依赖
npm install

# 构建
npm run build:packages
```

### 配置

```bash
# 交互式配置
npx colobot init

# 或手动创建配置文件
mkdir -p ~/.colobot
cat > ~/.colobot/config.json << 'EOF'
{
  "model": {
    "provider": "openai",
    "model": "gpt-4o",
    "apiKey": "your-api-key"
  },
  "search": {
    "engine": "duckduckgo",
    "maxResults": 10
  },
  "subAgent": {
    "maxConcurrent": 10,
    "allowedTools": ["read_file", "write_file", "web_search"]
  }
}
EOF
```

### 运行

```bash
# CLI 模式
npx colobot

# TUI 模式
npx colobot tui
```

---

## 功能模块

### 🤖 Agent 核心

| 功能 | 说明 |
|------|------|
| 多 Provider | OpenAI / Anthropic / MiniMax / Mock |
| Fallback | 链式降级，自动切换模型 |
| 流式输出 | 支持 SSE 流式响应 |
| 上下文压缩 | 超过窗口自动压缩历史 |
| 子 Agent | 创建、委托、销毁子 Agent |
| 工具白名单 | 子 Agent 受限权限控制 |

### 🛡️ 安全守护 (@colobot/sentinel)

独立的安全母 Agent，平行链路架构：

| 功能 | 说明 |
|------|------|
| **输入扫描** | Trie树敏感词、正则模式、长度/频率限制，<1ms 响应 |
| **输出扫描** | 异步检测，先放行后撤回 |
| **心跳监控** | 2秒间隔，3次失联判定 |
| **状态同步** | 父Agent状态实时同步，接管时有完整上下文 |
| **超时处理** | 30s警告 → 60s询问 → 120s接管 |
| **三层防御** | 规则引擎 → 本地模型 → LLM接管 |
| **分布式** | Redis 共享状态、Pub/Sub 信号 |

```typescript
import { Sentinel } from '@colobot/sentinel'

const sentinel = new Sentinel()
sentinel.start()

// 输入扫描
const result = sentinel.scanInput(userMessage, sessionId)
if (!result.pass) {
  return sentinel.scanInputWithTakeover(userMessage, sessionId).response
}

// 超时监控
sentinel.startSessionTimeout(sessionId, agentId)
```

### 🐍 Python WASM 沙箱

| 特性 | 说明 |
|------|------|
| 无需系统 Python | Pyodide 运行在 WebAssembly 中 |
| 跨平台 | macOS/Linux/Windows 统一行为 |
| 安全隔离 | WASM 沙箱天然隔离 |
| 动态包安装 | 支持 numpy, pandas, matplotlib 等 |

```typescript
// 执行 Python 代码
const result = await toolRegistry.get('python')!.execute({
  code: `
import numpy as np
arr = np.array([1, 2, 3])
print(arr.sum())
  `,
  packages: ['numpy'],
})
```

### 📋 个人助理 (@colobot/assistant)

| 模块 | 功能 |
|------|------|
| **待办清单** | 创建、优先级、截止日期、标签 |
| **提醒通知** | 定时、重复、自然语言创建 |
| **日程管理** | 日历、冲突检测、周/月视图 |
| **笔记系统** | Markdown、标签、全文搜索 |
| **习惯追踪** | 打卡、连续天数、统计 |
| **情绪日记** | 心情记录、趋势分析 |
| **财务管理** | 收支记录、分类统计 |
| **健康追踪** | 运动、睡眠、体重、饮水 |
| **学习进度** | 课程管理、进度追踪 |
| **阅读清单** | 书籍/文章、阅读进度 |
| **目标管理** | 目标设定、进度追踪 |
| **灵感笔记** | 快速记录、标签分类 |
| **人脉管理** | 联系人、互动记录 |
| **项目管理** | 项目追踪、里程碑 |
| **密码管理** | AES 加密、密码生成 |
| **时间追踪** | 开始/结束、分类统计 |
| **网页收藏** | URL、摘要、标签 |
| **意图识别** | 自然语言理解用户意图 |

### 🔧 内置工具

```
read_file      - 读取文件
write_file     - 写入文件
list_dir       - 列出目录
python         - 执行 Python (WASM 沙箱)
shell          - 执行 Shell 命令
web_search     - 网络搜索
http           - HTTP 请求
add_memory     - 添加记忆
search_memory  - 搜索记忆
spawn_subagent - 创建子 Agent
delegate_task  - 委托任务
...
```

---

## 编程使用

### 基础运行时

```typescript
import { AgentRuntime, OpenAIProvider, SQLiteStore } from '@colobot/core'

const runtime = new AgentRuntime({
  llm: new OpenAIProvider({ apiKey: 'your-key', defaultModel: 'gpt-4o' }),
  memory: new SQLiteStore({ path: '~/.colobot/chat.db' }),
})

const result = await runtime.run({
  agentId: 'my-agent',
  sessionKey: 'session-1',
  userMessage: '你好',
})

console.log(result.response)
```

### Python 执行

```typescript
import { PyodideRuntime } from '@colobot/core/tools'

const runtime = new PyodideRuntime()
const { output, error } = await runtime.runCode(`
import numpy as np
print(np.array([1, 2, 3]).sum())
`)

// 动态安装包
await runtime.installPackage('matplotlib')
```

### 使用助理功能

```typescript
import { createTodo, createReminderFromText, logMood, parseIntent } from '@colobot/assistant'

// 创建待办
const todo = createTodo({
  userId: 'user1',
  title: '完成报告',
  priority: 'high',
  dueDate: '2024-12-31',
})

// 自然语言创建提醒
const reminder = createReminderFromText('user1', '提醒我明天下午3点开会')

// 记录心情
logMood('user1', 'happy', 8, '今天很顺利')

// 意图识别
const intent = parseIntent('添加待办 完成报告')
// { type: 'todo.add', confidence: 0.9 }
```

---

## SOP 开源生态

ColoBot 支持可插拔的 SOP (Standard Operating Procedure) 流程模块。

### 架构

```
@colobot/sop-base          # 基础接口 + 注册器（官方）
@colobot/sop-academic      # 学术研究流程（官方示例）
colobot-sop-*              # 社区贡献（npm 发布）
```

### 官方 SOP 模块

| 模块 | 场景 | 状态 |
|------|------|------|
| `@colobot/sop-academic` | 论文写作、文献调研 | ✅ 已实现 |
| `@colobot/sop-writing` | 长文写作、报告生成 | 📋 规划中 |
| `@colobot/sop-coding` | 项目开发、代码重构 | 📋 规划中 |

---

## 开发指南

### 开发命令

```bash
# 构建所有包
npm run build:packages

# 构建单个包
npm run build --workspace=packages/core

# 测试
npm test

# 类型检查
npx tsc --noEmit
```

### 添加新工具

```typescript
// packages/core/src/tools/my-tool.ts
import { toolRegistry } from './registry.js'

export function registerMyTool(): void {
  toolRegistry.register({
    name: 'my_tool',
    description: 'My custom tool',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input' },
      },
      required: ['input'],
    },
    execute: async (args, ctx) => {
      return 'result'
    },
  })
}
```

---

## 项目统计

| 指标 | 数值 |
|------|------|
| 总代码量 | ~26,000 行 TypeScript |
| 源文件数 | 143 个 |
| 包数量 | 7 个 |
| 助理模块 | 18 个 |
| 测试用例 | 382 个 |
| 测试覆盖率 | 50%+ |

---

## 环境变量

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API Key |
| `ANTHROPIC_API_KEY` | Anthropic API Key |
| `MINIMAX_API_KEY` | MiniMax API Key |
| `COLOBOT_LOG_LEVEL` | 日志级别 (debug/info/warn/error) |
| `COLOBOT_LOG_CONSOLE` | 是否输出到控制台 (true/false) |
| `COLOBOT_ENCRYPTION_KEY` | 密码加密密钥 |

---

## 许可证

[AGPL-3.0](LICENSE)

---

## 贡献

欢迎提交 Issue 和 Pull Request。

---

## 致谢

- [OpenAI](https://openai.com/)
- [Anthropic](https://www.anthropic.com/)
- [Pyodide](https://pyodide.org/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [llm-guard](https://github.com/protectai/llm-guard)
- [Tesseract.js](https://github.com/naptha/tesseract.js)
- [@xenova/transformers](https://github.com/xenova/transformers.js)
