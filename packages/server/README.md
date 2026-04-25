# @colobot/server

ColoBot 完整服务整合包，一键启动 AI 智能体协作平台。

## 安装

```bash
npm install @colobot/server
```

## 使用方式

```bash
# 简单 CLI 模式
npx colobot

# TUI 界面
npx colobot tui

# 指定 Provider 和模型
npx colobot --provider anthropic --model claude-sonnet-4-20250514

# 指定搜索引擎
npx colobot --search duckduckgo

# 查看帮助
npx colobot --help
```

## CLI 选项

| 选项 | 说明 | 示例 |
|------|------|------|
| `tui` | 启动 TUI 界面 | `colobot tui` |
| `--provider` | LLM Provider (openai, anthropic) | `--provider anthropic` |
| `--model` | 模型名称 | `--model gpt-4o` |
| `--search` | 搜索引擎 (duckduckgo, google, bing) | `--search google` |
| `--api-key` | API Key | `--api-key sk-xxx` |
| `--config` | 配置文件路径 | `--config ./config.json` |
| `--version, -v` | 显示版本 | `--version` |
| `--help, -h` | 显示帮助 | `--help` |

## 环境变量

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API Key |
| `ANTHROPIC_API_KEY` | Anthropic API Key |

## 编程使用

```typescript
import { createRuntime, startColoBot } from '@colobot/server';

// 创建运行时
const { runtime, configManager, llm } = createRuntime({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: 'your-api-key',
});

// 运行对话
const result = await runtime.run({
  agentId: 'my-agent',
  sessionKey: 'session-1',
  userMessage: '你好',
});

console.log(result.response);

// 启动完整服务（TUI）
await startColoBot({
  provider: 'openai',
  enableTUI: true,
});
```

## 导出模块

### 核心功能
- `createRuntime` - 创建运行时
- `startColoBot` - 启动服务

### 配置
- `ConfigManager`, `initConfig`, `DEFAULT_CONFIG`, `getModelCapabilities`

### 运行时
- `AgentRuntime`, `OpenAIProvider`, `AnthropicProvider`

### 子 Agent
- `spawnSubAgent`, `destroySubAgent`, `runSubAgentTask`, `setGlobalAllowedTools`

### 工具
- `ToolRegistry`, `registerBuiltinTools`, `toolRegistry`

### 搜索
- `search`, `configureSearch`

### 分块
- `readChunksByBytes`, `mergeText`, `processChunksParallel`

### TUI
- `TUI`, `ChatUI`, `CommandPalette`, `StatusBar`, `LogPanel`

## License

Apache-2.0
