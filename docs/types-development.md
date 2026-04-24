# @colobot/types 开发方案

## 开发目标

从现有代码中提取类型定义，创建独立的 `@colobot/types` 包。

## 开发步骤

### Step 1: 创建包结构

```bash
# 创建目录
mkdir -p packages/types/src/{agent,llm,memory,tool,config,plugin,sop,error,common}

# 初始化 package.json
cat > packages/types/package.json << 'EOF'
{
  "name": "@colobot/types",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc --build",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
EOF

# 创建 tsconfig.json
cat > packages/types/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
EOF
```

### Step 2: 提取 Agent 类型

从 `src/agent-runtime/runtime.ts` 提取：

```typescript
// packages/types/src/agent/runtime.ts

/**
 * Agent 配置
 */
export interface AgentConfig {
  id: string
  name: string
  primaryModelId?: string
  fallbackModelId?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  soul?: AgentSoul
}

/**
 * Agent Soul 定义
 */
export interface AgentSoul {
  role: string
  personality: string
  rules: string[]
  skills: string[]
  goals?: string[]
}

/**
 * Agent 状态
 */
export type AgentStatus = 'active' | 'paused' | 'stopped'

// 从 src/agent-runtime/sub-agents.ts 提取
export interface SubAgentConfig {
  parentId: string
  name: string
  soulContent: string
  ttlMs: number
  allowedTools: string[]
}

export interface SubAgent {
  id: string
  name: string
  parentId: string
  soulContent: string
  ttlMs: number
  allowedTools: string[]
  createdAt: number
}
```

### Step 3: 提取 LLM 类型

从 `src/llm/index.ts` 提取：

```typescript
// packages/types/src/llm/provider.ts

export type LLMProviderType = 'openai' | 'anthropic' | 'minimax'

export interface LLMProvider {
  readonly name: LLMProviderType
  chat(messages: LLMMessage[], options?: ChatOptions): Promise<ChatResponse>
  chatStream?(messages: LLMMessage[], options?: ChatOptions): AsyncIterable<StreamChunk>
}

// packages/types/src/llm/message.ts

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | LLMContentBlock[]
}

export type LLMContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'audio_url'; audio_url: { url: string } }

// packages/types/src/llm/response.ts

export interface ChatResponse {
  content: string
  finishReason: 'stop' | 'length' | 'content_filter' | null
  usage?: TokenUsage
  raw?: unknown
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface StreamChunk {
  delta: string
  done: boolean
  finishReason?: 'stop' | 'length' | null
}

// packages/types/src/llm/config.ts

export interface LLMConfig {
  provider: LLMProviderType
  apiKey?: string
  model?: string
  apiEndpoint?: string
  temperature?: number
  maxTokens?: number
}
```

### Step 4: 提取 Tool 类型

从 `src/agent-runtime/tools/executor.ts` 提取：

```typescript
// packages/types/src/tool/definition.ts

export interface ToolDefinition {
  name: string
  description: string
  parameters: JSONSchema
  requireApproval?: boolean
  permission?: 'admin' | 'developer' | 'readonly'
  dangerLevel?: 'low' | 'medium' | 'high'
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolResult>

export interface ToolContext {
  agentId: string
  sessionKey: string
}

export interface ToolResult {
  success: boolean
  content: string
  error?: string
  needsApproval?: boolean
  approvalId?: string
}

export interface JSONSchema {
  type: string
  properties?: Record<string, JSONSchema>
  required?: string[]
  items?: JSONSchema
  enum?: string[]
  description?: string
  [key: string]: unknown
}
```

### Step 5: 提取 SOP 类型

从 `src/agent-runtime/sop-v2.ts` 提取：

```typescript
// packages/types/src/sop/state.ts

export interface SopState {
  taskId: string
  sessionKey: string
  agentId: string
  taskName: string
  taskSummary: string
  steps: SopStep[]
  currentStep: number
  status: SopStatus
  createdAt: string
  updatedAt: string
}

export interface SopStep {
  step: number
  name: string
  description?: string
  status: SopStepStatus
  userData: string | null
  subAgentResult: string | null
  approved: boolean
  reviewNote: string | null
  subAgentId: string | null
}

export type SopStatus = 'active' | 'paused' | 'completed' | 'cancelled'
export type SopStepStatus = 'pending' | 'in_progress' | 'done' | 'blocked'

// packages/types/src/sop/analysis.ts

export interface TaskAnalysis {
  isAcademicTask: boolean
  taskType: string
  taskName: string
  researchPurpose?: 'paper' | 'research' | 'learning'
  suggestedSteps: Array<{
    step: number
    name: string
    description?: string
  }>
  informationComplete: boolean
  missingInfo: string[]
}
```

### Step 6: 定义 Plugin 类型

新建插件接口：

```typescript
// packages/types/src/plugin/plugin.ts

import type { ToolDefinition, ConfigSchema } from '../index.js'

export interface ColoBotPlugin {
  name: string
  version: string
  description?: string
  
  tools?: ToolDefinition[]
  configSchema?: ConfigSchema | ConfigSchema[]
  cliCommands?: CLICommand[]
  
  onInit?: (context: PluginContext) => void | Promise<void>
  onDestroy?: () => void | Promise<void>
}

export interface PluginContext {
  config: ConfigManager
  tools: ToolRegistry
  logger: Logger
  db: DatabaseConnection
}

export interface CLICommand {
  name: string
  description?: string
  args?: CLIArg[]
  handler: (args: Record<string, unknown>, context: CLIContext) => Promise<void>
}

export interface CLIArg {
  name: string
  required?: boolean
  description?: string
  default?: unknown
}

// 占位类型，实现在 core 中
export interface ConfigManager { /* ... */ }
export interface ToolRegistry { /* ... */ }
export interface Logger { /* ... */ }
export interface DatabaseConnection { /* ... */ }
export interface CLIContext { /* ... */ }
```

### Step 7: 定义 Config 类型

```typescript
// packages/types/src/config/schema.ts

export interface ConfigSchema {
  key: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required?: boolean
  default?: unknown
  description?: string
  enum?: unknown[]
  properties?: Record<string, ConfigSchema>
  items?: ConfigSchema
  validate?: (value: unknown) => boolean | string
  envVar?: string
  sensitive?: boolean
}

export type ConfigSource = 'db' | 'env' | 'default' | 'cli'

export interface ConfigValue<T = unknown> {
  value: T
  source: ConfigSource
  updatedAt?: string
}
```

### Step 8: 定义 Error 类型

从 `src/utils/errors.ts` 提取：

```typescript
// packages/types/src/error/codes.ts

export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  LLM_ERROR = 'LLM_ERROR',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  LLM_CONTEXT_TOO_LONG = 'LLM_CONTEXT_TOO_LONG',
  
  DB_ERROR = 'DB_ERROR',
  DB_CONNECTION_ERROR = 'DB_CONNECTION_ERROR',
  
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  SUBAGENT_LIMIT_REACHED = 'SUBAGENT_LIMIT_REACHED',
  SUBAGENT_TIMEOUT = 'SUBAGENT_TIMEOUT',
  
  SOP_NOT_FOUND = 'SOP_NOT_FOUND',
  SOP_INVALID_STATE = 'SOP_INVALID_STATE',
  
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_PERMISSION_DENIED = 'TOOL_PERMISSION_DENIED',
  
  APPROVAL_NOT_FOUND = 'APPROVAL_NOT_FOUND',
  APPROVAL_ALREADY_PROCESSED = 'APPROVAL_ALREADY_PROCESSED',
}

// packages/types/src/error/result.ts

export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E }

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}
```

### Step 9: 统一导出

```typescript
// packages/types/src/index.ts

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

// Error
export * from './error/index.js'

// Common
export * from './common/index.js'
```

### Step 10: 更新现有代码引用

```typescript
// 修改前 (src/llm/index.ts)
interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | LLMContentBlock[]
}

// 修改后
import type { LLMMessage, ChatResponse } from '@colobot/types'
```

### Step 11: 配置 monorepo

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'src'  # 临时保留，后续迁移
```

```json
// 根 package.json 添加
{
  "scripts": {
    "build:types": "pnpm --filter @colobot/types build",
    "build": "pnpm build:types && tsc"
  }
}
```

### Step 12: 添加类型守卫（可选）

```typescript
// packages/types/src/common/guards.ts

import type { Result, LLMContentBlock } from '../index.js'

export function isOk<T>(result: Result<T>): result is { ok: true; value: T } {
  return result.ok === true
}

export function isErr<T>(result: Result<T>): result is { ok: false; error: Error } {
  return result.ok === false
}

export function isTextBlock(block: LLMContentBlock): block is { type: 'text'; text: string } {
  return block.type === 'text'
}

export function isImageBlock(block: LLMContentBlock): block is { type: 'image_url'; image_url: { url: string } } {
  return block.type === 'image_url'
}
```

## 迁移检查清单

```
[ ] 创建 packages/types 目录结构
[ ] 编写 package.json 和 tsconfig.json
[ ] 提取 Agent 类型
[ ] 提取 LLM 类型
[ ] 提取 Tool 类型
[ ] 提取 SOP 类型
[ ] 定义 Plugin 类型
[ ] 定义 Config 类型
[ ] 提取 Error 类型
[ ] 编写统一导出 index.ts
[ ] 构建测试
[ ] 更新现有代码引用
[ ] 发布到 npm
```

## 构建验证

```bash
cd packages/types
pnpm build

# 检查输出
ls dist/
# 应该看到:
# - index.js
# - index.d.ts
# - agent/index.d.ts
# - llm/index.d.ts
# - ...
```

## 发布

```bash
# 首次发布
cd packages/types
npm publish --access public

# 后续更新
npm version patch/minor/major
npm publish
```

## 时间估算

| 步骤 | 时间 |
|------|------|
| Step 1-2: 创建结构 + Agent 类型 | 2h |
| Step 3: LLM 类型 | 1h |
| Step 4: Tool 类型 | 1h |
| Step 5: SOP 类型 | 1h |
| Step 6-7: Plugin + Config 类型 | 2h |
| Step 8: Error 类型 | 1h |
| Step 9-10: 导出 + 更新引用 | 2h |
| Step 11-12: monorepo + 类型守卫 | 2h |
| **总计** | **12h (1.5天)** |
