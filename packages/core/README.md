# @colobot/core

ColoBot Agent 运行时核心包。

## 安装

```bash
npm install @colobot/core
```

## CLI 使用

```bash
# 设置 API Key
export OPENAI_API_KEY=your-api-key

# 或使用 Anthropic
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=your-api-key

# 运行 CLI
npx colobot-core
```

## 模块

### providers - LLM 提供者
- `OpenAIProvider` - OpenAI API
- `AnthropicProvider` - Anthropic API

### memory - 内存存储
- `initDb()` - 初始化 PostgreSQL 连接
- `embed()` - 生成向量嵌入
- `addMemory()` - 保存记忆
- `searchMemory()` - 语义搜索
- `hybridSearch()` - 混合搜索（向量+文本）

### content - 内容安全
- `ContentScanner` - 内容扫描器
- `detectThreat()` - 威胁检测
- `validateContent()` - 内容验证
- `detectPoisoning()` - 投毒检测

### approval - 审批流程
- `ApprovalFlow` - 审批流程管理
- `checkDangerousLevel()` - 四层漏斗检查

### compression - 上下文压缩
- `compressMessages()` - 压缩消息历史
- `estimateTokens()` - 估算 token 数

### search - 搜索集成
- `search()` - SearXNG 搜索
- `imageSearch()` - 图片搜索
- `academicSearch()` - 学术文献搜索

## 功能列表

| 功能 | 说明 |
|------|------|
| ✅ LLM Provider | OpenAI / Anthropic API |
| ✅ PostgreSQL 存储 | pgvector 向量支持 |
| ✅ 向量嵌入 | OpenAI / MiniMax Embeddings |
| ✅ 语义搜索 | 向量 + 文本混合搜索 |
| ✅ 内容安全 | 越狱/注入检测 |
| ✅ 威胁检测 | 卸载/删除威胁识别 |
| ✅ 投毒防御 | 信任等级 + 内容验证 |
| ✅ 审批流程 | 四层漏斗自动决策 |
| ✅ 上下文压缩 | LLM 摘要压缩 |
| ✅ 搜索集成 | SearXNG 多模态搜索 |
| ✅ 插件系统 | 工具/中间件注册 |
| ✅ CLI | 命令行交互 |

## 使用示例

### 完整运行时

```typescript
import {
  AgentRuntime,
  ToolRegistry,
  registerBuiltinTools,
  OpenAIProvider,
  initDb,
  ContentScanner,
  ApprovalFlow,
} from '@colobot/core';

// 初始化数据库
initDb({
  host: 'localhost',
  database: 'colobot',
  user: 'postgres',
  password: 'password',
});

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

### 审批流程

```typescript
import { ApprovalFlow, checkDangerousLevel } from '@colobot/core';

const flow = new ApprovalFlow();

// 创建审批请求
const approval = await flow.create({
  agentId: 'agent-1',
  requester: 'user-1',
  channel: 'web',
  actionType: 'delete',
  targetResource: 'file.txt',
});

// 检查危险级别
const decision = await checkDangerousLevel(toolCall);
console.log(decision.level); // 'require_approval'
```

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
