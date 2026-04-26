# ColoBotRuntime 接口文档

ColoBotRuntime 是插件与核心交互的统一接口。所有插件（sop-academic、feishu、dashboard 等）都通过此接口访问核心功能。

---

## 接口定义

```typescript
interface ColoBotRuntime {
  // 状态管理
  saveState(namespace: string, key: string, state: unknown): Promise<void>;
  loadState(namespace: string, key: string): Promise<unknown | null>;
  listStates(namespace: string): Promise<string[]>;
  deleteState(namespace: string, key: string): Promise<void>;

  // LLM 调用
  chat(prompt: string, options?: ChatOptions): Promise<string>;
  chatWithHistory(messages: LLMMessage[], options?: ChatOptions): Promise<string>;

  // Agent 管理
  createAgent(config: AgentConfig): Promise<string>;
  runAgent(agentId: string, message: string): Promise<string>;
  destroyAgent(agentId: string): Promise<void>;
  listAgents(): Promise<AgentInfo[]>;

  // Skill 管理
  registerSkill(skill: SkillDefinition): Promise<void>;
  listSkills(): Promise<SkillInfo[]>;
  executeSkill(skillId: string, input: unknown): Promise<unknown>;

  // 记忆
  addMemory(agentId: string, content: string, metadata?: Record<string, unknown>): Promise<void>;
  searchMemory(agentId: string, query: string, limit?: number): Promise<MemoryResult[]>;

  // 文件
  writeFile(path: string, content: string | Buffer): Promise<void>;
  readFile(path: string): Promise<string | Buffer>;
  listDir(path: string): Promise<FileInfo[]>;
  deleteFile(path: string): Promise<void>;

  // 配置
  getConfig(key: string): Promise<unknown>;
  setConfig(key: string, value: unknown): Promise<void>;
  deleteConfig(key: string): Promise<void>;

  // 审批
  createApproval(request: ApprovalRequest): Promise<string>;
  listApprovals(status?: ApprovalStatus): Promise<ApprovalInfo[]>;
  approveApproval(approvalId: string): Promise<void>;
  rejectApproval(approvalId: string, reason?: string): Promise<void>;

  // 审计
  writeAuditLog(entry: AuditEntry): Promise<void>;
  listAuditLogs(filter?: AuditFilter): Promise<AuditLog[]>;
}
```

---

## 使用示例

### 创建运行时

```typescript
import { ColoBotRuntimeImpl, type RuntimeDependencies } from '@colobot/core';
import { OpenAIProvider } from '@colobot/core/providers';
import { InMemoryStateStore } from '@colobot/core/adapters';
import { InMemoryStore } from '@colobot/core/adapters';

// 配置依赖
const deps: RuntimeDependencies = {
  llm: new OpenAIProvider({ apiKey: 'sk-xxx' }),
  stateStore: new InMemoryStateStore(),
  memoryStore: new InMemoryStore(),
  fileSystem: new LocalFileSystemAdapter({ rootDir: './data' }),
  // ... 其他依赖
};

// 创建运行时
const runtime = new ColoBotRuntimeImpl(deps);
```

### 状态管理

```typescript
// 保存状态
await runtime.saveState('sop', 'task-123', {
  status: 'in_progress',
  currentStep: 2,
  steps: [...]
});

// 加载状态
const state = await runtime.loadState('sop', 'task-123');

// 列出所有状态
const keys = await runtime.listStates('sop');

// 删除状态
await runtime.deleteState('sop', 'task-123');
```

### LLM 调用

```typescript
// 简单调用
const response = await runtime.chat('你好，请介绍一下自己');

// 带历史记录调用
const messages = [
  { role: 'system', content: '你是一个助手' },
  { role: 'user', content: '你好' },
  { role: 'assistant', content: '你好！有什么可以帮助你的？' },
  { role: 'user', content: '请写一个函数' },
];
const response = await runtime.chatWithHistory(messages);

// 带选项调用
const response = await runtime.chat('分析这段代码', {
  model: 'gpt-4o',
  temperature: 0.3,
  maxTokens: 4096,
});
```

### Agent 管理

```typescript
// 创建 Agent
const agentId = await runtime.createAgent({
  name: 'research-agent',
  soul: '你是一个文献调研助手...',
  primaryModel: 'openai:gpt-4o',
  fallbackModel: 'anthropic:claude-sonnet-4-6',
  tools: ['web_search', 'read_file'],
});

// 运行 Agent
const result = await runtime.runAgent(agentId, '搜索量子隧穿相关论文');

// 列出所有 Agent
const agents = await runtime.listAgents();

// 销毁 Agent
await runtime.destroyAgent(agentId);
```

### 记忆系统

```typescript
// 添加记忆
await runtime.addMemory(agentId, '用户偏好：喜欢简洁的回答', {
  type: 'preference',
  importance: 'high',
});

// 搜索记忆
const memories = await runtime.searchMemory(agentId, '用户偏好', 10);
```

### 文件操作

```typescript
// 写文件
await runtime.writeFile('./output/report.md', '# 研究报告\n...');

// 读文件
const content = await runtime.readFile('./data/input.txt');

// 列目录
const files = await runtime.listDir('./data');

// 删除文件
await runtime.deleteFile('./temp/cache.json');
```

### 审批流程

```typescript
// 创建审批请求
const approvalId = await runtime.createApproval({
  type: 'tool_call',
  tool: 'delete_file',
  params: { path: '/important/data.json' },
  reason: '用户请求删除文件',
});

// 查询待审批
const pending = await runtime.listApprovals('pending');

// 批准
await runtime.approveApproval(approvalId);

// 拒绝
await runtime.rejectApproval(approvalId, '文件重要，不允许删除');
```

---

## 依赖注入

ColoBotRuntime 通过依赖注入解耦具体实现：

```typescript
interface RuntimeDependencies {
  // LLM Provider
  llm: LLMProvider;

  // 状态存储
  stateStore: StateStore;

  // 记忆存储
  memoryStore: MemoryStore;

  // 文件系统
  fileSystem: FileSystemAdapter;

  // 工具注册表（可选）
  toolRegistry?: ToolRegistry;

  // 审批引擎（可选）
  approvalEngine?: ApprovalEngine;

  // 审计日志（可选）
  auditLog?: AuditLog;
}
```

### 可用实现

| 接口 | 实现 | 说明 |
|------|------|------|
| `LLMProvider` | `OpenAIProvider` | OpenAI GPT 系列 |
| | `AnthropicProvider` | Anthropic Claude 系列 |
| | `MiniMaxProvider` | MiniMax abab 系列 |
| | `MockProvider` | 测试用 Mock |
| `StateStore` | `InMemoryStateStore` | 内存存储 |
| | `DatabaseStateStore` | PostgreSQL 存储 |
| `MemoryStore` | `InMemoryStore` | 内存存储 |
| | `DatabaseStore` | PostgreSQL 存储 |
| | `SQLiteStore` | SQLite 存储（降级） |
| `FileSystemAdapter` | `LocalFileSystemAdapter` | 本地文件系统 |

---

## 插件开发指南

### 基本结构

```typescript
// my-plugin/src/index.ts
import type { ColoBotRuntime } from '@colobot/core';

export interface MyPluginConfig {
  // 插件配置
}

export function createMyPlugin(runtime: ColoBotRuntime, config: MyPluginConfig) {
  return {
    async doSomething() {
      // 使用 runtime 接口
      const state = await runtime.loadState('my-plugin', 'config');
      const result = await runtime.chat('...');
      await runtime.saveState('my-plugin', 'result', result);
      return result;
    },
  };
}
```

### 使用示例

```typescript
import { ColoBotRuntimeImpl } from '@colobot/core';
import { createMyPlugin } from '@colobot/my-plugin';

const runtime = new ColoBotRuntimeImpl(deps);
const plugin = createMyPlugin(runtime, { /* config */ });

await plugin.doSomething();
```

---

## 类型定义

详细类型定义请参考 `@colobot/types` 包：

```typescript
import type {
  LLMMessage,
  AgentConfig,
  AgentInfo,
  SkillDefinition,
  SkillInfo,
  MemoryResult,
  ApprovalRequest,
  ApprovalInfo,
  AuditEntry,
  AuditLog,
} from '@colobot/types';
```
