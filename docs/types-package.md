# @colobot/types - 共享类型定义包

## 概述

`@colobot/types` 是 ColoBot 所有包共享的类型定义包，提供统一的 TypeScript 类型系统，确保类型安全和开发体验一致性。

## 设计原则

1. **零运行时依赖** - 仅类型定义，无运行时代码
2. **单一职责** - 只定义类型，不包含实现
3. **向后兼容** - 类型变更需保持兼容性
4. **文档化** - 每个类型都有 JSDoc 注释

## 目录结构

```
packages/types/
├── src/
│   ├── index.ts            # 统一导出
│   │
│   ├── agent/              # Agent 相关类型
│   │   ├── index.ts
│   │   ├── runtime.ts      # Agent 运行时类型
│   │   ├── message.ts      # 消息类型
│   │   ├── sub-agent.ts    # 子 Agent 类型
│   │   └── soul.ts         # Soul 定义类型
│   │
│   ├── llm/                # LLM 相关类型
│   │   ├── index.ts
│   │   ├── provider.ts     # Provider 接口
│   │   ├── message.ts      # LLM 消息格式
│   │   ├── response.ts     # 响应格式
│   │   └── config.ts       # LLM 配置
│   │
│   ├── memory/             # 记忆系统类型
│   │   ├── index.ts
│   │   ├── vector.ts       # 向量记忆
│   │   ├── entry.ts        # 记忆条目
│   │   └── search.ts       # 搜索参数
│   │
│   ├── tool/               # 工具类型
│   │   ├── index.ts
│   │   ├── definition.ts   # 工具定义
│   │   ├── executor.ts     # 执行器类型
│   │   └── permission.ts   # 权限类型
│   │
│   ├── config/             # 配置类型
│   │   ├── index.ts
│   │   ├── schema.ts       # 配置 Schema
│   │   └── source.ts       # 配置来源
│   │
│   ├── plugin/             # 插件类型
│   │   ├── index.ts
│   │   ├── plugin.ts       # 插件定义
│   │   └── context.ts      # 插件上下文
│   │
│   ├── sop/                # SOP 类型
│   │   ├── index.ts
│   │   ├── state.ts        # SOP 状态
│   │   ├── step.ts         # 步骤类型
│   │   └── analysis.ts     # 任务分析
│   │
│   ├── approval/           # 审批类型
│   │   ├── index.ts
│   │   ├── request.ts      # 审批请求
│   │   └── decision.ts     # 审批决策
│   │
│   ├── error/              # 错误类型
│   │   ├── index.ts
│   │   ├── codes.ts        # 错误码
│   │   └── result.ts       # 结果类型
│   │
│   └── common/             # 通用类型
│       ├── index.ts
│       ├── locale.ts       # 语言/国际化
│       ├── id.ts           # ID 类型
│       └── timestamp.ts    # 时间戳类型
│
├── package.json
├── tsconfig.json
└── README.md
```

## 核心类型定义

### Agent 类型

```typescript
// src/agent/runtime.ts

/**
 * Agent 运行时配置
 */
export interface AgentConfig {
  /** Agent ID */
  id: string
  /** Agent 名称 */
  name: string
  /** 主模型 ID */
  primaryModelId?: string
  /** 备用模型 ID */
  fallbackModelId?: string
  /** 温度参数 */
  temperature?: number
  /** 最大 Token 数 */
  maxTokens?: number
  /** 系统提示词 */
  systemPrompt?: string
  /** Soul 定义 */
  soul?: AgentSoul
}

/**
 * Agent Soul 定义
 */
export interface AgentSoul {
  /** 角色定位 */
  role: string
  /** 性格特点 */
  personality: string
  /** 行为规则 */
  rules: string[]
  /** 技能列表 */
  skills: string[]
  /** 目标 */
  goals?: string[]
}

/**
 * Agent 状态
 */
export type AgentStatus = 'active' | 'paused' | 'stopped'

/**
 * 子 Agent 配置
 */
export interface SubAgentConfig {
  /** 父 Agent ID */
  parentId: string
  /** 子 Agent 名称 */
  name: string
  /** Soul 内容 */
  soulContent: string
  /** 存活时间（毫秒） */
  ttlMs: number
  /** 允许的工具列表 */
  allowedTools: string[]
}
```

### LLM 类型

```typescript
// src/llm/provider.ts

/**
 * LLM Provider 类型
 */
export type LLMProviderType = 'openai' | 'anthropic' | 'minimax'

/**
 * LLM Provider 接口
 */
export interface LLMProvider {
  /** Provider 名称 */
  readonly name: LLMProviderType
  
  /** 同步调用 */
  chat(messages: LLMMessage[], options?: ChatOptions): Promise<ChatResponse>
  
  /** 流式调用 */
  chatStream?(messages: LLMMessage[], options?: ChatOptions): AsyncIterable<StreamChunk>
  
  /** 获取可用模型 */
  listModels?(): Promise<ModelInfo[]>
  
  /** 计算 Token 数 */
  countTokens?(text: string): number
}

/**
 * LLM 消息
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | LLMContentBlock[]
}

/**
 * LLM 内容块（多模态）
 */
export type LLMContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'audio_url'; audio_url: { url: string } }

/**
 * 聊天选项
 */
export interface ChatOptions {
  /** 模型 ID */
  model?: string
  /** 温度 */
  temperature?: number
  /** 最大 Token */
  maxTokens?: number
  /** Top P */
  topP?: number
  /** 停止词 */
  stop?: string[]
  /** 流式输出 */
  stream?: boolean
}

/**
 * 聊天响应
 */
export interface ChatResponse {
  /** 响应内容 */
  content: string
  /** 完成原因 */
  finishReason: 'stop' | 'length' | 'content_filter' | null
  /** Token 使用量 */
  usage?: TokenUsage
  /** 原始响应 */
  raw?: unknown
}

/**
 * Token 使用量
 */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/**
 * 流式块
 */
export interface StreamChunk {
  /** 增量内容 */
  delta: string
  /** 是否结束 */
  done: boolean
  /** 完成原因 */
  finishReason?: 'stop' | 'length' | null
}
```

### Tool 类型

```typescript
// src/tool/definition.ts

/**
 * 工具定义
 */
export interface ToolDefinition {
  /** 工具名称 */
  name: string
  /** 工具描述 */
  description: string
  /** 参数 Schema (JSON Schema) */
  parameters: JSONSchema
  /** 是否需要审批 */
  requireApproval?: boolean
  /** 权限级别 */
  permission?: 'admin' | 'developer' | 'readonly'
  /** 危险等级 */
  dangerLevel?: 'low' | 'medium' | 'high'
  /** 执行函数 */
  handler?: ToolHandler
}

/**
 * 工具执行器
 */
export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolResult>

/**
 * 工具上下文
 */
export interface ToolContext {
  /** Agent ID */
  agentId: string
  /** Session Key */
  sessionKey: string
  /** 工具注册表 */
  toolRegistry?: ToolRegistry
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  /** 是否成功 */
  success: boolean
  /** 结果内容 */
  content: string
  /** 错误信息 */
  error?: string
  /** 是否需要审批 */
  needsApproval?: boolean
  /** 审批请求 ID */
  approvalId?: string
}

/**
 * JSON Schema 类型
 */
export interface JSONSchema {
  type: string
  properties?: Record<string, JSONSchema>
  required?: string[]
  items?: JSONSchema
  enum?: string[]
  description?: string
  default?: unknown
  [key: string]: unknown
}
```

### Config 类型

```typescript
// src/config/schema.ts

/**
 * 配置 Schema 定义
 */
export interface ConfigSchema {
  /** 配置键 */
  key: string
  /** 配置类型 */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  /** 是否必需 */
  required?: boolean
  /** 默认值 */
  default?: unknown
  /** 描述 */
  description?: string
  /** 枚举值 */
  enum?: unknown[]
  /** 嵌套 Schema */
  properties?: Record<string, ConfigSchema>
  /** 数组项 Schema */
  items?: ConfigSchema
  /** 验证函数 */
  validate?: (value: unknown) => boolean | string
  /** 环境变量名 */
  envVar?: string
  /** 敏感信息 */
  sensitive?: boolean
}

/**
 * 配置来源
 */
export type ConfigSource = 'db' | 'env' | 'default' | 'cli'

/**
 * 配置值（带来源）
 */
export interface ConfigValue<T = unknown> {
  /** 配置值 */
  value: T
  /** 配置来源 */
  source: ConfigSource
  /** 最后更新时间 */
  updatedAt?: string
}
```

### Plugin 类型

```typescript
// src/plugin/plugin.ts

/**
 * ColoBot 插件定义
 */
export interface ColoBotPlugin {
  /** 插件名称 */
  name: string
  /** 插件版本 */
  version: string
  /** 插件描述 */
  description?: string
  
  /** 注册的工具 */
  tools?: ToolDefinition[]
  
  /** 配置 Schema */
  configSchema?: ConfigSchema | ConfigSchema[]
  
  /** CLI 命令 */
  cliCommands?: CLICommand[]
  
  /** 初始化钩子 */
  onInit?: (context: PluginContext) => void | Promise<void>
  
  /** 销毁钩子 */
  onDestroy?: () => void | Promise<void>
}

/**
 * 插件上下文
 */
export interface PluginContext {
  /** 配置管理器 */
  config: ConfigManager
  /** 工具注册表 */
  tools: ToolRegistry
  /** 日志器 */
  logger: Logger
  /** 数据库连接 */
  db: DatabaseConnection
}

/**
 * CLI 命令定义
 */
export interface CLICommand {
  /** 命令名称 */
  name: string
  /** 命令描述 */
  description?: string
  /** 参数定义 */
  args?: CLIArg[]
  /** 命令处理函数 */
  handler: (args: Record<string, unknown>, context: CLIContext) => Promise<void>
}

/**
 * CLI 参数定义
 */
export interface CLIArg {
  /** 参数名 */
  name: string
  /** 是否必需 */
  required?: boolean
  /** 描述 */
  description?: string
  /** 默认值 */
  default?: unknown
}
```

### SOP 类型

```typescript
// src/sop/state.ts

/**
 * SOP 状态
 */
export interface SopState {
  /** 任务 ID */
  taskId: string
  /** Session Key */
  sessionKey: string
  /** Agent ID */
  agentId: string
  /** 任务名称 */
  taskName: string
  /** 任务摘要 */
  taskSummary: string
  /** 步骤列表 */
  steps: SopStep[]
  /** 当前步骤 */
  currentStep: number
  /** 状态 */
  status: SopStatus
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/**
 * SOP 步骤
 */
export interface SopStep {
  /** 步骤号 */
  step: number
  /** 步骤名称 */
  name: string
  /** 步骤描述 */
  description?: string
  /** 步骤状态 */
  status: SopStepStatus
  /** 用户数据 */
  userData: string | null
  /** 子 Agent 结果 */
  subAgentResult: string | null
  /** 是否已审核 */
  approved: boolean
  /** 审核意见 */
  reviewNote: string | null
  /** 子 Agent ID */
  subAgentId: string | null
}

/**
 * SOP 状态枚举
 */
export type SopStatus = 'active' | 'paused' | 'completed' | 'cancelled'

/**
 * SOP 步骤状态
 */
export type SopStepStatus = 'pending' | 'in_progress' | 'done' | 'blocked'

/**
 * 任务分析结果
 */
export interface TaskAnalysis {
  /** 是否为学术任务 */
  isAcademicTask: boolean
  /** 任务类型 */
  taskType: string
  /** 任务名称 */
  taskName: string
  /** 研究目的 */
  researchPurpose?: 'paper' | 'research' | 'learning'
  /** 建议步骤 */
  suggestedSteps: Omit<SopStep, 'status' | 'userData' | 'subAgentResult' | 'approved' | 'reviewNote' | 'subAgentId'>[]
  /** 信息是否完整 */
  informationComplete: boolean
  /** 缺失信息 */
  missingInfo: string[]
}
```

### Error 类型

```typescript
// src/error/codes.ts

/**
 * 错误码枚举
 */
export enum ErrorCode {
  // 通用
  UNKNOWN = 'UNKNOWN',
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // LLM
  LLM_ERROR = 'LLM_ERROR',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  LLM_CONTEXT_TOO_LONG = 'LLM_CONTEXT_TOO_LONG',
  
  // 数据库
  DB_ERROR = 'DB_ERROR',
  DB_CONNECTION_ERROR = 'DB_CONNECTION_ERROR',
  
  // Agent
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  SUBAGENT_LIMIT_REACHED = 'SUBAGENT_LIMIT_REACHED',
  SUBAGENT_TIMEOUT = 'SUBAGENT_TIMEOUT',
  
  // SOP
  SOP_NOT_FOUND = 'SOP_NOT_FOUND',
  SOP_INVALID_STATE = 'SOP_INVALID_STATE',
  
  // 工具
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_PERMISSION_DENIED = 'TOOL_PERMISSION_DENIED',
  
  // 审批
  APPROVAL_NOT_FOUND = 'APPROVAL_NOT_FOUND',
  APPROVAL_ALREADY_PROCESSED = 'APPROVAL_ALREADY_PROCESSED',
}

/**
 * 结果类型（Rust 风格）
 */
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E }

/**
 * 分页参数
 */
export interface Pagination {
  /** 页码（从 1 开始） */
  page?: number
  /** 每页数量 */
  limit?: number
  /** 偏移量 */
  offset?: number
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  /** 数据列表 */
  items: T[]
  /** 总数 */
  total: number
  /** 当前页 */
  page: number
  /** 每页数量 */
  limit: number
  /** 是否有更多 */
  hasMore: boolean
}
```

## 类型导出策略

```typescript
// src/index.ts

// Agent
export * from './agent/index.js'

// LLM
export * from './llm/index.js'

// Memory
export * from './memory/index.js'

// Tool
export * from './tool/index.js'

// Config
export * from './config/index.js'

// Plugin
export * from './plugin/index.js'

// SOP
export * from './sop/index.js'

// Approval
export * from './approval/index.js'

// Error
export * from './error/index.js'

// Common
export * from './common/index.js'
```

## package.json

```json
{
  "name": "@colobot/types",
  "version": "0.1.0",
  "description": "Shared TypeScript type definitions for ColoBot",
  "license": "Apache-2.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./agent": {
      "types": "./dist/agent/index.d.ts",
      "import": "./dist/agent/index.js"
    },
    "./llm": {
      "types": "./dist/llm/index.d.ts",
      "import": "./dist/llm/index.js"
    },
    "./tool": {
      "types": "./dist/tool/index.d.ts",
      "import": "./dist/tool/index.js"
    },
    "./plugin": {
      "types": "./dist/plugin/index.d.ts",
      "import": "./dist/plugin/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  },
  "peerDependencies": {
    "typescript": ">=5.0.0"
  },
  "keywords": [
    "colobot",
    "types",
    "typescript",
    "ai",
    "agent"
  ]
}
```

## 使用方式

### 在其他包中使用

```typescript
// @colobot/core
import type { 
  AgentConfig, 
  LLMProvider, 
  ToolDefinition,
  ColoBotPlugin 
} from '@colobot/types'

// @colobot/sop
import type { SopState, SopStep, TaskAnalysis } from '@colobot/types'

// 按需导入子模块
import type { LLMMessage, ChatResponse } from '@colobot/types/llm'
```

### 类型守卫

```typescript
// src/common/guards.ts

import type { Result, LLMContentBlock } from '@colobot/types'

export function isOk<T>(result: Result<T>): result is { ok: true; value: T } {
  return result.ok === true
}

export function isTextBlock(block: LLMContentBlock): block is { type: 'text'; text: string } {
  return block.type === 'text'
}

export function isImageBlock(block: LLMContentBlock): block is { type: 'image_url'; image_url: { url: string } } {
  return block.type === 'image_url'
}
```

## 开发计划

| 阶段 | 内容 | 时间 |
|------|------|------|
| Phase 1 | 基础类型（Agent, LLM, Tool） | 0.5 天 |
| Phase 2 | 配置和插件类型 | 0.5 天 |
| Phase 3 | SOP 和审批类型 | 0.5 天 |
| Phase 4 | 错误和通用类型 | 0.5 天 |
| Phase 5 | 类型守卫和工具函数 | 0.5 天 |
| Phase 6 | 文档和测试 | 0.5 天 |
| **总计** | | **3 天** |

## 类型兼容性策略

### 版本控制

```typescript
// 使用版本后缀处理破坏性变更
interface LLMMessageV1 {
  role: string
  content: string
}

interface LLMMessageV2 {
  role: 'system' | 'user' | 'assistant'
  content: string | LLMContentBlock[]
}

// 类型别名指向最新版本
type LLMMessage = LLMMessageV2
```

### 废弃标记

```typescript
/**
 * @deprecated 使用 ChatResponse 代替
 */
type LLMResponse = ChatResponse
```

## 测试策略

```typescript
// tests/types.test.ts
import { describe, it, expectTypeOf } from 'vitest'
import type { AgentConfig, LLMMessage, Result } from '../src/index.js'

describe('Type definitions', () => {
  it('AgentConfig should have required fields', () => {
    expectTypeOf<AgentConfig>().toHaveProperty('id').toBeString()
    expectTypeOf<AgentConfig>().toHaveProperty('name').toBeString()
  })

  it('LLMMessage should support multimodal content', () => {
    const message: LLMMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'image_url', image_url: { url: 'https://...' } }
      ]
    }
    expectTypeOf(message).toMatchTypeOf<LLMMessage>()
  })

  it('Result type should be discriminated union', () => {
    const success: Result<string> = { ok: true, value: 'test' }
    const failure: Result<string> = { ok: false, error: new Error('fail') }
    
    if (success.ok) {
      expectTypeOf(success.value).toBeString()
    }
  })
})
```

## 与其他包的关系

```
@colobot/types
    ↑
    │ (所有包依赖)
    │
├── @colobot/core
├── @colobot/tui
├── @colobot/sop
├── @colobot/feishu
├── @colobot/tools-minimax
├── @colobot/skills-openclaw
├── @colobot/dashboard
└── @colobot/server
```

## 优势

1. **类型安全** - 所有包共享一致的类型定义
2. **开发体验** - IDE 自动补全和类型检查
3. **文档化** - 类型即文档
4. **零运行时** - 仅类型定义，不影响包大小
5. **版本管理** - 类型变更可独立发布
6. **按需导入** - 支持子模块导入减少编译时间