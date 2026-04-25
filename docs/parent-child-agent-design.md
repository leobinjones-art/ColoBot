# 父子 Agent 架构设计

## 概述

ColoBot 采用**父子 Agent 架构**，实现任务分解、执行、审核的完整闭环。

```
┌─────────────────────────────────────────────────────────┐
│                      用户请求                            │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    父 Agent                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  任务分析   │→│  任务拆解   │→│  创建子Agent │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│         ▲                                    │          │
│         │            ┌─────────────┐         │          │
│         └────────────│  成果审核   │←────────┘          │
│                      └─────────────┘                    │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    子 Agent                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  执行任务   │→│  调用工具   │→│  返回结果   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                         │
│  约束：工具白名单、TTL过期、权限隔离                    │
└─────────────────────────────────────────────────────────┘
```

## 核心概念

### 父 Agent

**职责：** 全局把控，不直接执行具体操作

| 职能 | 说明 |
|------|------|
| 任务分析 | 理解用户意图，判断需要什么工具/能力 |
| 任务拆解 | 将复杂任务分解为可执行的子任务 |
| 子Agent管理 | 创建、监控、销毁子 Agent |
| 成果审核 | 检查子 Agent 输出，验证正确性 |
| 用户展示 | 整合结果，向用户呈现最终答案 |

**特点：**
- 拥有完整工具权限
- 可访问所有记忆和上下文
- 负责安全决策和权限控制

### 子 Agent

**职责：** 执行具体任务，受限运行

| 职能 | 说明 |
|------|------|
| 执行任务 | 完成父 Agent 分配的具体步骤 |
| 工具调用 | 在白名单范围内调用工具 |
| 结果返回 | 将执行结果返回给父 Agent |

**约束：**
- 工具白名单：只能使用允许的工具
- TTL 过期：默认 5 分钟，超时自动销毁
- 权限隔离：无法访问父 Agent 的敏感资源
- 并发限制：全局最多 10 个活跃子 Agent

## 任务拆解流程

### 1. AI 驱动的动态分析

```typescript
// 用户请求
"分析这份销售数据表格"

// AI 分析结果
{
  taskType: "分析",
  description: "分析销售数据表格",
  requiredTools: ["read_file", "python"],
  reasoning: "需要读取表格并进行数据分析",
  subTasks: [
    {
      name: "读取表格",
      description: "读取销售数据表格文件",
      tools: ["read_file"],
      dependencies: []
    },
    {
      name: "数据分析",
      description: "使用Python分析销售数据",
      tools: ["python"],
      dependencies: ["读取表格"],
      inputFromDeps: ["读取表格"]  // 接收前置任务输出
    },
    {
      name: "生成报告",
      description: "生成分析报告",
      tools: ["write_file"],
      dependencies: ["数据分析"],
      inputFromDeps: ["数据分析"]
    }
  ]
}
```

### 2. 子任务执行

```
┌──────────────┐
│   读取表格    │ → 输出: "表格有1000行，10列..."
└──────┬───────┘
       │ (自动注入到下一个任务的 prompt)
       ▼
┌──────────────┐
│   数据分析    │ → prompt: "分析数据\n\n前置结果:\n表格有1000行..."
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   生成报告    │ → 输出: "销售分析报告.md"
└──────────────┘
```

### 3. 并行执行

无依赖的子任务可并行执行：

```
┌──────────────┐     ┌──────────────┐
│   搜索天气    │     │   搜索新闻    │  (并行)
└──────┬───────┘     └──────┬───────┘
       │                    │
       └────────┬───────────┘
                ▼
         ┌──────────────┐
         │   汇总结果    │
         └──────────────┘
```

## 子 Agent 管理

### 生命周期

```
创建 → 运行 → 完成/失败 → 销毁
         │
         └──→ 超时 → 自动销毁
```

### 创建子 Agent

```typescript
const subAgent = spawnSubAgent({
  name: '数据分析器',
  soulContent: JSON.stringify({
    role: '数据分析专家',
    task: '分析销售数据',
  }),
  parentId: 'parent-agent-1',
  allowedTools: ['read_file', 'python'],
  ttlMs: 300000,  // 5分钟
});
```

### 执行任务

```typescript
const result = await runSubAgentTask(
  subAgent,
  '分析销售数据的趋势',
  parentId,
  deps  // LLM、审计、工具执行器等依赖
);
```

### 销毁子 Agent

```typescript
// 手动销毁
destroySubAgent(subAgentId, parentId);

// 自动清理（每30秒检查过期）
// TTL 到期后自动销毁
```

## 数据传递机制

### 子任务间数据传递

```typescript
// 子任务定义
{
  name: "数据分析",
  tools: ["python"],
  dependencies: ["读取表格"],
  inputFromDeps: ["读取表格"]  // 声明需要前置任务的输出
}

// 执行时自动注入
// prompt = "分析数据\n\n前置任务结果：\n表格有1000行..."
```

### 执行上下文

```typescript
interface ExecutionContext {
  taskId: string;
  parentId: string;
  results: Map<string, ExecutionResult>;

  // 获取依赖任务的输出
  getDependencyOutput: (depName: string) => string | undefined;

  // 获取依赖任务的结构化数据
  getDependencyData: (depName: string) => any | undefined;
}
```

## 安全机制

### 工具白名单

```typescript
// 子 Agent 只能使用允许的工具
const subAgent = spawnSubAgent({
  allowedTools: ['read_file', 'python'],
  // ...
});

// 尝试调用未授权工具会被拦截
if (!isToolAllowed(subAgentId, 'delete_file')) {
  // 拒绝执行，记录审计日志
}
```

### 权限隔离

| 资源 | 父 Agent | 子 Agent |
|------|----------|----------|
| 所有工具 | ✅ | ❌ 仅白名单 |
| 敏感数据 | ✅ | ❌ 隔离 |
| 记忆存储 | ✅ 完整 | ❌ 受限 |
| 审计日志 | ✅ 读写 | ❌ 只读 |

### 审计追踪

```typescript
// 所有操作记录审计日志
await audit.write({
  actorType: 'agent',
  actorId: subAgent.id,
  action: 'tool.call',
  targetId: 'read_file',
  detail: { path: '/data/sales.csv' },
  result: 'success',
});
```

## 大文件处理

当文件超过限制时，自动分块处理：

```
大文件(100MB)
    │
    ▼
┌─────────────────┐
│   检测文件大小   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   分块(100KB/块) │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│ 分块1 │ │ 分块2 │ ... (并行处理)
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│   合并结果       │
└─────────────────┘
```

### 分块策略

| 策略 | 适用场景 |
|------|----------|
| 按字节 | 二进制文件、大文本 |
| 按行 | CSV、日志文件 |
| 按 Token | LLM 输入优化 |
| 滑动窗口 | 需要保持上下文连续性 |

### 合并策略

| 策略 | 用途 |
|------|------|
| 文本拼接 | 直接合并文本结果 |
| 数组展平 | 合并列表数据 |
| 统计汇总 | 汇总处理统计 |
| 去重合并 | 提取任务去重 |

## 典型场景

### 场景1：天气查询

```
用户: "今天北京天气如何"

父Agent分析:
  → 需要工具: web_search
  → 子任务: 搜索天气

创建子Agent(工具: web_search)
  → 执行搜索
  → 返回: "北京今天晴天，25°C"

父Agent审核 → 展示给用户
```

### 场景2：表格分析

```
用户: "分析这份销售表格"

父Agent分析:
  → 需要工具: read_file, python
  → 子任务: 读取表格 → 数据分析 → 生成报告

子Agent1(读取表格) → 输出: "1000行数据"
    ↓ (数据传递)
子Agent2(数据分析) → 输出: "发现3个趋势"
    ↓
子Agent3(生成报告) → 输出: "report.md"

父Agent审核 → 展示给用户
```

### 场景3：大文件处理

```
用户: "处理这个1GB的日志文件"

父Agent分析:
  → 文件过大，需要分块
  → 子任务: 分块处理(并行) → 合并结果

子Agent1(分块1) ┐
子Agent2(分块2) ├→ 并行执行
子Agent3(分块3) ┘
    ↓
合并结果 → 返回父Agent
```

## 代码示例

### 完整流程

```typescript
import {
  analyzeRequest,
  executeDynamicTask,
  cleanupTaskResult,
} from '@colobot/core';

// 1. 分析请求
const analysis = await analyzeRequest(
  '分析这份销售数据',
  llm,
  { tools: customTools }
);

// 2. 执行任务
const result = await executeDynamicTask(
  '分析这份销售数据',
  'parent-1',
  llm,
  {
    llm,
    audit: auditLogger,
    parseTools,
    executeTools,
    formatResults,
    maxParallel: 3,
    onSubTaskStart: async (subTask, subAgentId, ctx) => {
      console.log(`开始执行: ${subTask.name}`);
    },
    onSubTaskComplete: async (subTask, result, ctx) => {
      console.log(`完成: ${subTask.name}`);
    },
  }
);

// 3. 展示结果
console.log(result.finalOutput);

// 4. 清理
cleanupTaskResult(result, 'parent-1');
```

### 自定义工具注入

```typescript
const customTools = [
  { name: 'web_search', description: '网络搜索', capabilities: ['搜索', '天气'] },
  { name: 'read_file', description: '读取文件', capabilities: ['文件', '表格'] },
  { name: 'python', description: 'Python执行', capabilities: ['分析', '计算'] },
  { name: 'chunk_read', description: '分块读取', capabilities: ['大文件', '分块'] },
];

const result = await executeDynamicTask(
  request,
  parentId,
  llm,
  { ...deps, tools: customTools }
);
```

## 设计原则

1. **职责分离**：父 Agent 决策，子 Agent 执行
2. **最小权限**：子 Agent 只获得完成任务所需的最小权限
3. **安全隔离**：子 Agent 之间相互隔离，无法互相访问
4. **自动清理**：TTL 过期自动销毁，防止资源泄漏
5. **审计追踪**：所有操作可追溯
6. **并行优先**：无依赖任务并行执行，提高效率
7. **数据传递**：子任务间自动传递输出，保持上下文

## 扩展点

1. **自定义工具**：通过 `deps.tools` 注入
2. **自定义处理器**：实现 `ChunkProcessor` 处理分块
3. **自定义合并**：实现 `MergeStrategy` 合并结果
4. **回调钩子**：`onSubTaskStart/Complete` 监控执行过程
