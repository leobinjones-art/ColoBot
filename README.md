# ColoBot

<div align="center">

**单智能体 + 子智能体协作平台**

多模态 AI × Skill 编排 × 个人助理

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-18+-green.svg)](https://nodejs.org/)

</div>

---

## 📖 目录

- [简介](#简介)
- [功能特性](#功能特性)
- [架构设计](#架构设计)
- [快速开始](#快速开始)
- [使用指南](#使用指南)
- [API 文档](#api-文档)
- [开发指南](#开发指南)
- [路线图](#路线图)

---

## 简介

ColoBot 是一个基于 TypeScript 的 AI Agent 框架，专注于**个人助理**场景。支持多模态交互、子 Agent 协作、工具调用，并内置完整的个人信息管理功能。

### 核心特点

- 🤖 **多 LLM 支持**: OpenAI、Anthropic、MiniMax、自定义 API
- 🧠 **子 Agent 协作**: 任务分解、并行执行、工具白名单
- 🖼️ **多模态**: 文本、图片、音频
- 📋 **个人助理**: 待办、提醒、日程、笔记、习惯追踪等 18 个模块
- 🔧 **工具系统**: 内置 20+ 工具，支持自定义扩展
- 💾 **记忆系统**: SQLite/PostgreSQL 持久化，向量搜索

---

## 功能特性

### 🤖 Agent 核心

| 功能        | 说明                                |
| ----------- | ----------------------------------- |
| 多 Provider | OpenAI / Anthropic / MiniMax / Mock |
| Fallback    | 链式降级，自动切换模型              |
| 流式输出    | 支持 SSE 流式响应                   |
| 上下文压缩  | 超过窗口自动压缩历史                |
| 子 Agent    | 创建、委托、销毁子 Agent            |
| 工具白名单  | 子 Agent 受限权限控制               |

### 📋 个人助理 (@colobot/assistant)

| 模块         | 功能                         |
| ------------ | ---------------------------- |
| **待办清单** | 创建、优先级、截止日期、标签 |
| **提醒通知** | 定时、重复、自然语言创建     |
| **日程管理** | 日历、冲突检测、周/月视图    |
| **笔记系统** | Markdown、标签、全文搜索     |
| **习惯追踪** | 打卡、连续天数、统计         |
| **情绪日记** | 心情记录、趋势分析           |
| **财务管理** | 收支记录、分类统计           |
| **健康追踪** | 运动、睡眠、体重、饮水       |
| **学习进度** | 课程管理、进度追踪           |
| **阅读清单** | 书籍/文章、阅读进度          |
| **目标管理** | 目标设定、进度追踪           |
| **灵感笔记** | 快速记录、标签分类           |
| **人脉管理** | 联系人、互动记录             |
| **项目管理** | 项目追踪、里程碑             |
| **密码管理** | AES 加密、密码生成           |
| **时间追踪** | 开始/结束、分类统计          |
| **网页收藏** | URL、摘要、标签              |
| **意图识别** | 自然语言理解用户意图         |

### 🔧 内置工具

```
read_file      - 读取文件
write_file     - 写入文件
list_dir       - 列出目录
web_search     - 网络搜索
image_search   - 图片搜索
academic_search - 学术搜索
python         - 执行 Python 代码
http           - HTTP 请求
add_memory     - 添加记忆
search_memory  - 搜索记忆
spawn_subagent - 创建子 Agent
delegate_task  - 委托任务
...
```

---

## 架构设计

### 包结构

```
colobot/
├── packages/
│   ├── types/           # 类型定义
│   ├── core/            # 核心运行时
│   │   ├── providers/   # LLM Provider
│   │   ├── runtime/     # Agent 运行时
│   │   ├── memory/      # 记忆系统
│   │   ├── tools/       # 工具系统
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

### 依赖关系

```
@colobot/types
      ↓
@colobot/core
      ↓
┌─────────────────┬─────────────────┐
│                 │                 │
@colobot/assistant  @colobot/tui    @colobot/sop-academic
      ↓
@colobot/gateway (规划中)
```

### 数据流

```
用户输入 → 意图识别 → Agent Runtime → LLM → 工具调用 → 响应
                ↓
            记忆系统 ← 向量搜索
                ↓
            子 Agent (可选)
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

## 使用指南

### CLI 命令

```
colobot [command]

Commands:
  init        交互式配置
  tui         终端交互界面
  help        显示帮助
  version     显示版本

交互命令:
  /image <url|path>  添加图片
  /images            查看待发送图片
  /clear-images      清空图片
  /config            显示配置
  /tools             显示工具列表
  /help              显示帮助
  /exit              退出
```

### 多模态输入

```
> /image https://example.com/photo.jpg
[已添加图片 URL]

> /image /path/to/local.png
[已添加本地图片]

> 这张图片里有什么？
[AI 分析图片内容...]
```

### 编程使用

```typescript
import { AgentRuntime, OpenAIProvider, SQLiteStore } from '@colobot/core'

const runtime = new AgentRuntime({
  llm: new OpenAIProvider({ apiKey: 'your-key', defaultModel: 'gpt-4o' }),
  memory: new SQLiteStore({ path: '~/.colobot/chat.db' }),
  // ...
})

const result = await runtime.run({
  agentId: 'my-agent',
  sessionKey: 'session-1',
  userMessage: '你好',
})

console.log(result.response)
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

## API 文档

### @colobot/core

#### AgentRuntime

```typescript
interface RunOptions {
  agentId: string
  sessionKey: string
  userMessage: string | ContentBlock[]
  maxRounds?: number
  systemPrompt?: string
  soul?: { personality?: string; role?: string }
}

interface RunResult {
  response: string | ContentBlock[]
  toolCalls: string[]
  finished: boolean
}

class AgentRuntime {
  run(options: RunOptions): Promise<RunResult>
  runStream(options: RunOptions): AsyncGenerator<string>
}
```

#### LLM Provider

```typescript
interface LLMProvider {
  name: string;
  chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  chatStream(messages: LLMMessage[], options?: LLMOptions): AsyncIterable<LLMStreamChunk>;
}

// OpenAI
new OpenAIProvider({ apiKey, defaultModel, baseUrl? });

// Anthropic
new AnthropicProvider({ apiKey, defaultModel });

// MiniMax
new MiniMaxProvider({ apiKey, defaultModel });
```

#### 子 Agent

```typescript
// 创建子 Agent
const agent = spawnSubAgent({
  name: 'research-agent',
  soulContent: JSON.stringify({ role: '研究助手' }),
  parentId: 'parent-agent-id',
  allowedTools: ['web_search', 'read_file'],
})

// 委托任务
const result = await runSubAgentTask(agent, task, parentId, deps)

// 销毁
destroySubAgent(agent.id, parentId)
```

### @colobot/assistant

#### 待办清单

```typescript
createTodo(input: {
  userId: string;
  title: string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  tags?: string[];
}): Todo;

listTodos(userId: string, filter?: TodoFilter): Todo[];
completeTodo(id: string, userId: string): Todo;
getTodayTodos(userId: string): Todo[];
```

#### 提醒

```typescript
createReminder(input: {
  userId: string;
  title: string;
  remindAt: string | Date;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
}): Reminder;

createReminderFromText(userId: string, text: string): Reminder;
startReminderCheck(intervalMs?: number): void;
```

#### 时间解析

```typescript
parseTime(text: string, now?: Date): {
  time: Date;
  isRange: boolean;
  endTime?: Date;
  confidence: number;
} | null;

// 支持: 明天、后天、下周三、3小时后、下午3点、2024-12-31 10:00
```

#### 意图识别

```typescript
parseIntent(text: string): {
  type: 'todo.add' | 'reminder.add' | 'note.add' | ... | 'unknown';
  confidence: number;
  slots: Record<string, string>;
};
```

---

## 开发指南

### 项目结构

```
packages/
├── types/          # 共享类型
├── core/           # 核心包
├── assistant/      # 助理包
├── tui/            # TUI 包
├── sop-base/       # SOP 基础接口
└── sop-academic/   # SOP 包

_legacy/            # 旧代码（待迁移）
```

### 开发命令

```bash
# 构建所有包
npm run build:packages

# 构建单个包
npm run build --workspace=packages/core

# 测试
npm test

# 测试单个包
npm test --workspace=packages/core

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

### 添加新助理模块

```typescript
// packages/assistant/src/my-module/index.ts
import { getDb, generateId } from '../db/schema.js'

export function createMyEntry(userId: string, data: any): MyEntry {
  const db = getDb()
  const id = generateId()
  // ...
}
```

---

## 路线图

### v0.3.0 (计划中)

- [ ] Web UI (React)
- [ ] 流式输出到终端
- [ ] 提高测试覆盖率到 50%+
- [ ] 完善错误处理和错误码
- [ ] **SOP 开源生态**: `@colobot/sop-base` 接口 + 社区贡献机制

### v0.4.0

- [ ] @colobot/gateway 包 (飞书、钉钉、邮件)
- [ ] 语音交互
- [ ] 多设备同步
- [ ] 官方 SOP 扩展: `@colobot/sop-writing`, `@colobot/sop-coding`

### v0.5.0

- [ ] 插件市场
- [ ] SOP 插件市场
- [ ] 性能监控
- [ ] 云端部署方案

---

## SOP 开源生态

ColoBot 支持可插拔的 SOP (Standard Operating Procedure) 流程模块，社区可自行贡献特定领域的流程扩展。

### 架构

```
@colobot/sop-base          # 基础接口 + 注册器（官方）
@colobot/sop-academic      # 学术研究流程（官方示例）
colobot-sop-*              # 社区贡献（npm 发布）
```

### 官方 SOP 模块

| 模块                    | 场景               | 状态      |
| ----------------------- | ------------------ | --------- |
| `@colobot/sop-academic` | 论文写作、文献调研 | ✅ 已实现 |
| `@colobot/sop-writing`  | 长文写作、报告生成 | 📋 规划中 |
| `@colobot/sop-coding`   | 项目开发、代码重构 | 📋 规划中 |

### 开发 SOP 模块

```typescript
import type { SopModule } from '@colobot/sop-base'

export const mySop: SopModule = {
  name: 'my-domain',
  version: '1.0.0',
  description: '我的领域流程',

  detectIntent(message) {
    return /关键词/i.test(message)
  },

  async analyzeTask(message, runtime) {
    // 分析任务，返回步骤列表
  },

  stepTemplates: [
    { name: '步骤1', description: '...' },
    { name: '步骤2', description: '...' },
  ],
}
```

详细规划见 [docs/sop-ecosystem-plan.md](docs/sop-ecosystem-plan.md)。

---

## 环境变量

| 变量                     | 说明                             |
| ------------------------ | -------------------------------- |
| `OPENAI_API_KEY`         | OpenAI API Key                   |
| `ANTHROPIC_API_KEY`      | Anthropic API Key                |
| `MINIMAX_API_KEY`        | MiniMax API Key                  |
| `COLOBOT_LOG_LEVEL`      | 日志级别 (debug/info/warn/error) |
| `COLOBOT_LOG_CONSOLE`    | 是否输出到控制台 (true/false)    |
| `COLOBOT_ENCRYPTION_KEY` | 密码加密密钥                     |

---

## 日志文件

| 文件                           | 说明          |
| ------------------------------ | ------------- |
| `~/.colobot/logs/cli.log`      | CLI 日志      |
| `~/.colobot/logs/tui.log`      | TUI 日志      |
| `~/.colobot/logs/subagent.log` | 子 Agent 日志 |

---

## 项目统计

| 指标       | 数值                  |
| ---------- | --------------------- |
| 总代码量   | ~20,500 行 TypeScript |
| 源文件数   | 115 个                |
| 包数量     | 6 个                  |
| 助理模块   | 18 个                 |
| 数据表     | 15 张                 |
| SOP 模块   | 1 个（学术研究）      |
| 测试用例   | 292 个                |
| 测试覆盖率 | 45%                   |

---

## 许可证

[AGPL-3.0](LICENSE)

---

## 贡献

欢迎提交 Issue 和 Pull Request。

### 贡献 SOP 模块

1. Fork 本仓库
2. 创建 `colobot-sop-{domain}` 包
3. 实现 `SopModule` 接口
4. 发布到 npm
5. 提交 PR 到文档列表

详见 [docs/sop-ecosystem-plan.md](docs/sop-ecosystem-plan.md)。

---

## 致谢

- [OpenAI](https://openai.com/)
- [Anthropic](https://www.anthropic.com/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [llm-guard](https://github.com/protectai/llm-guard)
- [Tesseract.js](https://github.com/naptha/tesseract.js)
- [@xenova/transformers](https://github.com/xenova/transformers.js)
