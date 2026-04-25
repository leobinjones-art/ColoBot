# @colobot/core

ColoBot Agent 运行时核心库。

## 安装

```bash
npm install @colobot/core
```

## 功能模块

| 模块 | 说明 |
|------|------|
| 配置管理 | 多层级配置、模型能力自动计算 |
| 子Agent | 生命周期管理、工具白名单、并发控制 |
| 任务拆解 | AI驱动动态拆解、依赖处理、并行执行 |
| 大文件处理 | 分块、流式、多策略合并 |
| 搜索 | SearXNG/DuckDuckGo/Google/Bing |
| 内置工具 | 12个工具（文件/搜索/执行/网络/数据） |

## CLI 使用

```bash
# 设置 API Key
export OPENAI_API_KEY=your-api-key

# 或使用 Anthropic
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=your-api-key

# 运行 CLI
npx colobot-core

# 指定模型
colobot-core -p anthropic -m claude-sonnet-4-20250514

# 指定配置文件
colobot-core -c /path/to/config.json
```

### CLI 命令

```
/config              显示当前配置
/set model.provider  设置提供商 (openai/anthropic)
/set model.model     设置模型
/set search.engine   设置搜索引擎
/set subagent.max    设置最大并发
/set allow <tool>    允许工具
/set block <tool>    禁止工具
/tools               列出工具白名单
/exit                退出
```

## 配置

### 配置优先级

1. 环境变量（最高）
2. 配置文件
3. 默认值

### 环境变量

```bash
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
LLM_API_KEY=sk-xxx
SEARCH_ENGINE=duckduckgo
SUBAGENT_ALLOWED_TOOLS=read_file,write_file,web_search
SUBAGENT_MAX_CONCURRENT=10
```

### 配置文件

`~/.colobot/config.json` 或 `./colobot.config.json`

```json
{
  "model": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.7
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
```

## 内置工具

| 工具 | 功能 |
|------|------|
| `read_file` | 读取文件 |
| `write_file` | 写入文件 |
| `list_dir` | 列出目录 |
| `delete_file` | 删除文件 |
| `web_search` | 网络搜索 |
| `python` | 执行 Python |
| `shell` | 执行 Shell（危险） |
| `http` | HTTP 请求 |
| `json_parse` | JSON 解析 |
| `csv_parse` | CSV 解析 |
| `calculate` | 数学计算 |
| `echo` | 测试用 |

## 架构

```
用户请求
    ↓
父 Agent（任务分析 → 任务拆解 → 创建子Agent）
    ↓
子 Agent（执行任务 → 调用工具 → 返回结果）
    ↓
父 Agent（成果审核 → 用户展示）
```

详见 [父子Agent架构设计](../../docs/parent-child-agent-design.md)

## 使用示例

### 完整运行时

```typescript
import {
  AgentRuntime,
  ToolRegistry,
  registerBuiltinTools,
  initConfig,
  setGlobalAllowedTools,
  OpenAIProvider,
} from '@colobot/core';

// 初始化配置
const config = initConfig();

// 设置工具白名单
setGlobalAllowedTools(['read_file', 'write_file', 'web_search']);

// 注册内置工具
registerBuiltinTools();

// 创建运行时
const runtime = new AgentRuntime({
  llm: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! }),
  memory: new InMemoryStore(),
  tools: new ToolExecutorImpl(new ToolRegistry()),
  scanner: new ContentScanner(),
  audit: new ConsoleAudit(),
  pusher: new ConsolePusher(),
});

// 运行对话
const result = await runtime.run({
  agentId: 'my-agent',
  sessionKey: 'session-1',
  userMessage: 'Hello!',
});
```

### 任务拆解

```typescript
import { analyzeRequest, executeDynamicTask } from '@colobot/core';

// 分析请求
const analysis = await analyzeRequest('分析销售数据', llm, deps);

// 执行任务（自动创建子Agent）
const result = await executeDynamicTask('分析销售数据', 'parent-1', llm, deps);
```

### 子Agent管理

```typescript
import { spawnSubAgent, runSubAgentTask } from '@colobot/core';

// 创建子Agent
const agent = spawnSubAgent({
  name: '数据分析器',
  soulContent: JSON.stringify({ role: '数据分析专家' }),
  parentId: 'parent-1',
  allowedTools: ['read_file', 'python'],
});

// 执行任务
const result = await runSubAgentTask(agent, '分析数据', 'parent-1', deps);
```

### 大文件处理

```typescript
import { processChunksParallel, mergeText } from '@colobot/core';

// 分块并行处理
const results = await processChunksParallel(
  largeContent,
  async (chunk, index) => {
    return { chunkIndex: index, success: true, result: processed };
  },
  { chunkSize: 100000, overlap: 1000, format: 'bytes' },
  3 // 并行数
);

// 合并结果
const final = mergeText(results);
```

### 模型能力

```typescript
import { getModelCapabilities } from '@colobot/core';

// 获取模型能力（自动计算分块参数）
const caps = getModelCapabilities('gpt-4o');
// { contextWindow: 128000, recommendedChunkSize: 100000, recommendedParallel: 3 }

const caps2 = getModelCapabilities('claude-sonnet-4-20250514');
// { contextWindow: 200000, recommendedChunkSize: 150000, recommendedParallel: 3 }
```

### 向量搜索

```typescript
import { initDb, addMemory, searchMemory, hybridSearch } from '@colobot/core';

initDb();

// 保存记忆
await addMemory('agent-1', 'key-1', '这是一段记忆内容');

// 语义搜索
const results = await searchMemory('agent-1', '记忆');

// 混合搜索
const hybrid = await hybridSearch('agent-1', '记忆');
```

### 内容安全

```typescript
import { ContentScanner, detectThreat, validateContent } from '@colobot/core';

const scanner = new ContentScanner();

// 扫描输入
const result = await scanner.scanInput('hello world');
console.log(result.safe); // true

// 检测威胁
const threat = detectThreat('删除 AI');
console.log(threat.isThreat); // true
```

## 功能列表

| 功能 | 说明 |
|------|------|
| ✅ LLM Provider | OpenAI / Anthropic API |
| ✅ 配置管理 | 多层级配置、模型能力自动计算 |
| ✅ 子Agent | 生命周期、工具白名单、并发控制 |
| ✅ 任务拆解 | AI驱动、依赖处理、并行执行 |
| ✅ 大文件处理 | 分块、流式、多策略合并 |
| ✅ 搜索集成 | 4引擎支持 |
| ✅ 内置工具 | 12个工具 |
| ✅ PostgreSQL 存储 | pgvector 向量支持 |
| ✅ 向量嵌入 | OpenAI / MiniMax Embeddings |
| ✅ 语义搜索 | 向量 + 文本混合搜索 |
| ✅ 内容安全 | 越狱/注入检测 |
| ✅ 威胁检测 | 卸载/删除威胁识别 |
| ✅ 投毒防御 | 信任等级 + 内容验证 |
| ✅ 审批流程 | 四层漏斗自动决策 |
| ✅ 上下文压缩 | LLM 摘要压缩 |
| ✅ 插件系统 | 工具/中间件注册 |
| ✅ CLI | 命令行交互 |

## 构建

```bash
npm run build
```

## 测试

```bash
npm test
```

## License

Apache-2.0
