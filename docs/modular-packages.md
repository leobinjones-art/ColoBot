# ColoBot 模块化拆包方案

## 目标

将 ColoBot 拆分为独立 npm 包，支持按需安装，降低部署复杂度。

## 包结构

```
packages/
├── core/                    # @colobot/core - 核心包（必需）
│   ├── src/
│   │   ├── agent-runtime/   # Agent 运行时
│   │   ├── llm/             # LLM 抽象层
│   │   ├── memory/          # 记忆系统
│   │   ├── config/          # 配置管理
│   │   ├── utils/           # 工具函数
│   │   └── index.ts         # 导出入口
│   ├── package.json
│   └── tsconfig.json
│
├── sop/                     # @colobot/sop - SOP 流程（可选）
│   ├── src/
│   │   ├── sop-v2.ts        # SOP 状态机
│   │   ├── prompts.ts       # Prompt 模板
│   │   ├── sub-agents.ts    # 子 Agent 配置
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── feishu/                  # @colobot/feishu - 飞书集成（可选）
│   ├── src/
│   │   ├── feishu.ts        # 飞书服务
│   │   ├── webhook.ts       # Webhook 处理
│   │   ├── cards.ts         # 交互式卡片
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── dashboard/               # @colobot/dashboard - Web 管理界面（可选）
│   ├── src/
│   │   ├── index.html       # 单文件前端
│   │   └── serve.ts         # 静态文件服务
│   ├── package.json
│   └── tsconfig.json
│
└── server/                  # @colobot/server - 完整服务（整合包）
    ├── src/
    │   ├── colobot-server.ts
    │   ├── routes/
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

## 依赖关系

```
@colobot/server
    ├── @colobot/core (必需)
    ├── @colobot/sop (可选)
    ├── @colobot/feishu (可选)
    └── @colobot/dashboard (可选)

@colobot/sop
    └── @colobot/core

@colobot/feishu
    └── @colobot/core

@colobot/dashboard
    └── @colobot/core
```

## 安装方式

### 最小安装（仅核心）

```bash
npm install @colobot/core
```

功能：Agent 运行时、LLM 调用、记忆系统、基础工具

### SOP 流程

```bash
npm install @colobot/core @colobot/sop
```

功能：学术研究 SOP 流程、AI 动态拆解、步骤引导

### 飞书集成

```bash
npm install @colobot/core @colobot/feishu
```

功能：飞书 Bot、交互式卡片、审批通知

### 完整安装

```bash
npm install @colobot/server
```

功能：包含所有模块，开箱即用

## 包详情

### @colobot/core

**职责**：核心 Agent 运行时、LLM 抽象、记忆系统

**导出**：
```typescript
// Agent
export { AgentRuntime } from './agent-runtime/runtime.js'
export { spawnSubAgent, destroySubAgent } from './agent-runtime/sub-agents.js'

// LLM
export { chat, chatStream } from './llm/index.js'
export { getDefaultModel, getApiEndpoint } from './config/llm.js'

// Memory
export { addMemory, searchMemory } from './memory/vector.js'
export { query, queryOne } from './memory/db.js'

// Tools
export { registerTool, executeTools } from './agent-runtime/tools/executor.js'

// Config
export { getSubAgentConfig } from './config/sub-agents.js'

// Utils
export { ColoBotError, safeExecute } from './utils/errors.js'
export { detectLocale, getMessages } from './i18n/index.js'
```

**依赖**：
- `pg` - PostgreSQL 客户端
- `pgvector` - 向量扩展
- `ws` - WebSocket

### @colobot/sop

**职责**：SOP 学术研究流程

**导出**：
```typescript
export { aiAnalyzeTask } from './sop-v2.js'
export { createSop, getSopState, saveSopState } from './sop-v2.js'
export { generateStepGuidance, aiReviewSubAgentOutput } from './sop-v2.js'
export { generateFinalOutput } from './sop-v2.js'
export { getSopPrompt, fillPrompt } from './prompts.js'
export { getSubAgentConfig, SubAgentType } from './sub-agents.js'
```

**依赖**：
- `@colobot/core`

### @colobot/feishu

**职责**：飞书 Bot 集成

**导出**：
```typescript
export { FeishuService } from './feishu.js'
export { handleFeishuEvent } from './webhook.js'
export { sendInteractiveCard, updateCardStatus } from './cards.js'
```

**依赖**：
- `@colobot/core`
- `@larksuiteoapi/node-sdk`

### @colobot/dashboard

**职责**：Web 管理界面

**导出**：
```typescript
export { serveDashboard } from './serve.js'
```

**依赖**：
- `@colobot/core`

### @colobot/server

**职责**：完整服务，整合所有模块

**导出**：
```typescript
export { startServer } from './index.js'
```

**依赖**：
- `@colobot/core`
- `@colobot/sop`
- `@colobot/feishu`
- `@colobot/dashboard`

## 配置统一

所有包共享同一套配置系统：

```typescript
// 配置优先级
// 1. 代码中显式传入
// 2. 数据库配置
// 3. 环境变量
// 4. 默认值

import { ConfigManager } from '@colobot/core'

const config = new ConfigManager({
  db: { host: 'localhost', port: 5432 },
  llm: { provider: 'openai', apiKey: 'sk-...' }
})
```

## 迁移步骤

### Phase 1: 准备工作

1. 创建 `packages/` 目录结构
2. 配置 monorepo 工具（pnpm workspace 或 turborepo）
3. 抽取共享类型定义到 `@colobot/types`

### Phase 2: 核心包

1. 迁移 `src/agent-runtime/` → `packages/core/src/agent-runtime/`
2. 迁移 `src/llm/` → `packages/core/src/llm/`
3. 迁移 `src/memory/` → `packages/core/src/memory/`
4. 迁移 `src/config/` → `packages/core/src/config/`
5. 迁移 `src/utils/` → `packages/core/src/utils/`
6. 迁移 `src/i18n/` → `packages/core/src/i18n/`
7. 编写单元测试

### Phase 3: 可选包

1. 迁移 SOP 相关代码 → `packages/sop/`
2. 迁移飞书相关代码 → `packages/feishu/`
3. 迁移 Dashboard → `packages/dashboard/`

### Phase 4: 整合包

1. 创建 `packages/server/`
2. 整合所有模块
3. 编写启动脚本

### Phase 5: 发布

1. 配置 npm 发布流程
2. 编写各包 README
3. 发布到 npm

## 使用示例

### 仅使用核心包

```typescript
import { AgentRuntime, chat } from '@colobot/core'

const runtime = new AgentRuntime({
  agentId: 'my-agent',
  dbConfig: { host: 'localhost' }
})

const response = await runtime.processMessage('Hello!')
```

### 使用 SOP 流程

```typescript
import { AgentRuntime } from '@colobot/core'
import { aiAnalyzeTask, createSop } from '@colobot/sop'

const analysis = await aiAnalyzeTask('量子计算研究')
if (analysis.isAcademicTask) {
  const sop = await createSop(agentId, sessionKey, analysis)
}
```

### 使用飞书集成

```typescript
import { FeishuService } from '@colobot/feishu'

const feishu = new FeishuService({
  appId: 'cli_xxx',
  appSecret: 'xxx'
})

await feishu.sendMessage(openId, 'Hello from ColoBot!')
```

### 完整服务

```typescript
import { startServer } from '@colobot/server'

await startServer({
  port: 18792,
  db: { host: 'localhost' },
  llm: { provider: 'openai' },
  feishu: { appId: 'cli_xxx', appSecret: 'xxx' },
  sop: { enabled: true }
})
```

## 优势

1. **按需安装**：用户只需安装需要的功能
2. **依赖隔离**：不使用飞书的用户无需安装 `@larksuiteoapi/node-sdk`
3. **版本独立**：各包可独立发布版本
4. **易于扩展**：新增模块不影响核心包
5. **社区友好**：开发者可贡献特定模块

## 时间估算

| 阶段 | 工作量 | 时间 |
|------|--------|------|
| Phase 1 | 准备工作 | 1 天 |
| Phase 2 | 核心包 | 3 天 |
| Phase 3 | 可选包 | 2 天 |
| Phase 4 | 整合包 | 1 天 |
| Phase 5 | 发布 | 1 天 |
| **总计** | | **8 天** |
