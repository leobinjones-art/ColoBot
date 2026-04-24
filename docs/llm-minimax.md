# @colobot/llm-minimax - MiniMax LLM 兼容

## 概述

`@colobot/llm-minimax` 提供 MiniMax API 的完整兼容适配器，让 ColoBot 能够无缝调用 MiniMax 的大语言模型。

## MiniMax API 特性

| 特性 | 说明 |
|------|------|
| 🌐 多模态 | 支持文本、图片输入 |
| 🔄 流式输出 | 支持 SSE 流式响应 |
| ⚡ 高性能 | 国产模型，国内低延迟 |
| 💰 成本优化 | 相比 GPT-4 更低成本 |
| 🔐 安全合规 | 符合国内监管要求 |

## 支持的模型

| 模型 ID | 说明 | 上下文长度 |
|---------|------|------------|
| `abab6.5-chat` | MiniMax 6.5 对话模型 | 32K |
| `abab6.5s-chat` | MiniMax 6.5S 快速模型 | 8K |
| `abab5.5-chat` | MiniMax 5.5 对话模型 | 16K |
| `abab5.5s-chat` | MiniMax 5.5S 快速模型 | 8K |

## 安装

```bash
npm install @colobot/llm-minimax
```

## 使用

### 基础调用

```typescript
import { MiniMaxProvider } from '@colobot/llm-minimax'

const minimax = new MiniMaxProvider({
  apiKey: 'your-minimax-api-key',
  groupId: 'your-group-id',      // MiniMax 需要 groupId
  model: 'abab6.5-chat'
})

const response = await minimax.chat([
  { role: 'user', content: '你好，介绍一下自己' }
])

console.log(response.content)
```

### 流式输出

```typescript
const stream = await minimax.chatStream([
  { role: 'user', content: '写一首诗' }
])

for await (const chunk of stream) {
  process.stdout.write(chunk.delta)
}
```

### 多模态输入

```typescript
const response = await minimax.chat([
  {
    role: 'user',
    content: [
      { type: 'text', text: '描述这张图片' },
      { type: 'image_url', image_url: { url: 'https://...' } }
    ]
  }
])
```

### 与 ColoBot Core 集成

```typescript
import { LLMRegistry } from '@colobot/core'
import { MiniMaxProvider } from '@colobot/llm-minimax'

// 注册 MiniMax Provider
LLMRegistry.register('minimax', MiniMaxProvider)

// 现在可以通过 ColoBot Core 调用
import { chat } from '@colobot/core'

const response = await chat(messages, {
  provider: 'minimax',
  model: 'abab6.5-chat'
})
```

## API 兼容

### 请求格式转换

ColoBot 标准格式 → MiniMax API 格式：

```typescript
// ColoBot 输入
{
  messages: [
    { role: 'user', content: 'Hello' }
  ],
  options: {
    temperature: 0.7,
    maxTokens: 1000
  }
}

// 转换为 MiniMax 请求
{
  model: 'abab6.5-chat',
  messages: [
    { role: 'user', content: 'Hello' }
  ],
  temperature: 0.7,
  max_tokens: 1000,
  stream: false
}
```

### 响应格式转换

MiniMax API 响应 → ColoBot 标准格式：

```typescript
// MiniMax 响应
{
  choices: [{
    message: {
      role: 'assistant',
      content: 'Hello! How can I help you?'
    },
    finish_reason: 'stop'
  }],
  usage: {
    total_tokens: 20
  }
}

// 转换为 ColoBot 格式
{
  content: 'Hello! How can I help you?',
  finishReason: 'stop',
  usage: {
    totalTokens: 20
  }
}
```

## 特殊处理

### Group ID

MiniMax API 需要 `groupId` 参数：

```typescript
const minimax = new MiniMaxProvider({
  apiKey: process.env.MINIMAX_API_KEY,
  groupId: process.env.MINIMAX_GROUP_ID  // 必需
})
```

### Token 计费

MiniMax 使用不同的计费方式：

```typescript
interface MiniMaxUsage {
  total_tokens: number
  input_tokens: number
  output_tokens: number
  // MiniMax 特有
  prompt_tokens_details?: {
    cached_tokens: number  // 缓存命中的 token
  }
}
```

### 错误处理

MiniMax 错误码映射：

| MiniMax 错误码 | ColoBot 错误码 |
|----------------|----------------|
| `1000` | `INVALID_INPUT` |
| `1001` | `UNAUTHORIZED` |
| `1002` | `LLM_RATE_LIMIT` |
| `1003` | `LLM_CONTEXT_TOO_LONG` |
| `2000` | `LLM_ERROR` |

## 配置

### 环境变量

```bash
MINIMAX_API_KEY=your-api-key
MINIMAX_GROUP_ID=your-group-id
MINIMAX_MODEL=abab6.5-chat
MINIMAX_API_ENDPOINT=https://api.minimax.chat/v1/text/chatcompletion_v2
```

### 配置文件

```typescript
const config = {
  provider: 'minimax',
  apiKey: '...',
  groupId: '...',
  model: 'abab6.5-chat',
  options: {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.9,
    stream: true
  }
}
```

## API

### MiniMaxProvider

```typescript
class MiniMaxProvider implements LLMProvider {
  constructor(config: MiniMaxConfig)
  
  // 同步调用
  async chat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResponse>
  
  // 流式调用
  async chatStream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncIterable<StreamChunk>
  
  // 获取可用模型
  async listModels(): Promise<Model[]>
  
  // 计算 token 数
  countTokens(text: string): number
}
```

### MiniMaxConfig

```typescript
interface MiniMaxConfig {
  apiKey: string
  groupId: string
  model?: string
  apiEndpoint?: string
  timeout?: number
  retries?: number
}
```

## 目录结构

```
packages/llm-minimax/
├── src/
│   ├── index.ts            # 导出入口
│   ├── provider.ts         # MiniMax Provider 实现
│   ├── client.ts           # API 客户端
│   ├── converter.ts        # 请求/响应转换
│   ├── stream.ts           # 流式处理
│   ├── errors.ts           # 错误处理
│   ├── models.ts           # 模型定义
│   └── types/
│       ├── request.ts      # 请求类型
│       └── response.ts     # 响应类型
├── tests/
│   ├── provider.test.ts
│   ├── converter.test.ts
│   └── stream.test.ts
├── package.json
└── README.md
```

## 依赖

```json
{
  "dependencies": {
    "@colobot/core": "^0.1.0",
    "eventsource": "^2.0.2"    // SSE 流式处理
  }
}
```

## Dashboard 集成

在 LLM 设置页面添加 MiniMax 配置：

```
┌─────────────────────────────────────────────────────────────┐
│ LLM Settings                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Provider: [OpenAI ▼]                                        │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ MiniMax Configuration                                │    │
│ │                                                     │    │
│ │ API Key:      [••••••••••••••••••]                   │    │
│ │ Group ID:     [your-group-id     ]                   │    │
│ │ Model:        [abab6.5-chat ▼    ]                   │    │
│ │                                                     │    │
│ │ Models:                                             │    │
│ │   • abab6.5-chat (32K context)                      │    │
│ │   • abab6.5s-chat (8K, faster)                      │    │
│ │   • abab5.5-chat (16K)                              │    │
│ │                                                     │    │
│ │ [Test Connection]  [Save]                           │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 与其他 Provider 对比

| 特性 | OpenAI | Anthropic | MiniMax |
|------|--------|-----------|---------|
| 文本 | ✅ | ✅ | ✅ |
| 图片 | ✅ | ✅ | ✅ |
| 音频 | ✅ | ❌ | ❌ |
| 流式 | ✅ | ✅ | ✅ |
| 国内访问 | 需代理 | 需代理 | ✅ 直连 |
| 成本 | 高 | 高 | 低 |

## 开发计划

| 阶段 | 功能 | 时间 |
|------|------|------|
| Phase 1 | API 客户端 + 基础调用 | 1 天 |
| Phase 2 | 流式输出 | 1 天 |
| Phase 3 | 格式转换 + 错误处理 | 1 天 |
| Phase 4 | Dashboard 集成 + 测试 | 1 天 |
| **总计** | | **4 天** |

## 与其他包的关系

```
@colobot/llm-minimax
    └── @colobot/core (必需)
```

## 使用场景

1. **国内部署**：无需代理，直接访问
2. **成本优化**：相比 OpenAI 降低成本
3. **合规要求**：符合国内监管
4. **多 Provider Fallback**：作为 Fallback 链的一环
