# ColoBot 渐进演进方向（借鉴 hermes-agent）

## 定位差异

| | **ColoBot** | **hermes-agent** |
|---|---|---|
| 定位 | 单智能体协作平台 + 向量记忆 RAG | 通用自进化 AI 助手 |
| 语言 | TypeScript/Node.js | Python |
| 存储 | PostgreSQL + pgvector | SQLite + JSON 文件 |
| 消息 | 自研 WS/HTTP API | ACP 协议 + 20+ 平台适配器 |
| 审批 | 单层 approval（危险工具阻断） | 三层审批（Tirith 规则 + Pattern + Smart LLM） |
| 进化 | Soul/Skill 走审批流，可审计还原 | 全自动自进化，无感知 |
| 用户画像 | 无 | Honcho dialectic modeling |

---

## 一、短期：ToolRegistry + check_fn（权限控制更细）

### 现状

ColoBot 目前用硬编码 map 标识危险工具：

```typescript
// runtime.ts
const DANGEROUS_TOOLS: Record<string, ApprovalActionType> = {
  send_message: 'send',
  exec_code: 'exec',
  delete_agent: 'delete',
  update_agent: 'update',
  spawn_subagent: 'update',
};
```

权限判断只有 `__parent__`（父 agent 全能）和 `subAgentId`（子 agent 按 allowlist 过滤）两层。

### hermes 的做法

hermes 每个工具注册时挂载 `check_fn`，运行时做权限检查：

```python
@tool_registry.register(trigger="sudo", check_fn=lambda ctx: ctx.user.is_admin)
async def sudo(ctx, cmd): ...

# 工具注册时可以声明需要的权限级别
@tool_registry.register(trigger="exec_code", roles=["admin", "developer"])
async def exec_code(ctx, cmd): ...
```

`check_fn` 可以访问 `ctx.user`（用户身份）、`ctx.session`（会话上下文），判断粒度远细于"是否父 agent"。

### ColoBot 演进方案

```typescript
// 工具注册表（tools/index.ts）
interface ToolDef {
  name: string;
  description: string;
  check_fn?: (ctx: ToolContext) => boolean | Promise<boolean>;
  dangerous?: boolean;          // 是否需要审批
  approval_type?: ApprovalActionType;  // 审批类型
  roles?: string[];             // 允许的角色
}

interface ToolContext {
  agentId: string;
  sessionKey: string;
  userId?: string;               // 认证用户
  roles?: string[];              // 用户角色
  ipAddress?: string;
}

// 内置工具注册时附带 check_fn
registerTool('exec_code', execCodeHandler, {
  dangerous: true,
  approval_type: 'exec',
  roles: ['admin', 'developer'],
  check_fn: async (ctx) => {
    // 规则自动审批：开发者角色在工作时间自动过
    if (ctx.roles?.includes('developer') && isWorkHours()) return true;
    return false;
  }
});
```

**好处**：
- 工具权限声明和执行逻辑分离
- `check_fn` 支持规则自动审批（不用每次等人工）
- 未来可以支持用户角色体系（admin/developer/readonly 等）

### 收益

- 减少人工审批次数（规则自动过）
- 权限体系可扩展（支持 RBAC）
- 工具注册表可枚举，API 可查询"某工具有什么权限要求"

---

## 二、中期：多层审批流（减少误拦）

### 现状

ColoBot 当前是**单层阻断**：

```
危险工具调用 → 创建 approval_request → 人工 approve/reject → 执行
```

所有未匹配规则的工具调用都会阻断，等待人工处理。高频合法操作（如 search_memory、get_time）也会走审批，效率低。

### hermes 的三层漏斗

hermes 用三层逐步过滤：

```
Tirith（规则引擎）→ Pattern Matching（高频模式）→ Smart LLM（意图判断）
```

**第一层：Tirith 规则引擎**
- 基于 IP 白名单、时间窗口、用户角色做静态判断
- 命中直接过或直接拒，不用调用 LLM
- 例：`IP 在白名单内 → 自动过`

**第二层：Pattern Matching**
- 检测高频操作模式（如"每分钟调用 10 次 send_message"）
- 命中触发滑动窗口限流或强制冷却
- 例："连续 3 次 exec_code" → Pattern 预警

**第三层：Smart LLM**
- 用另一个 LLM 判断意图是否恶意
- 给出判断理由，可追溯
- 例："用户要求删除所有数据" → LLM 认为高度危险，强制人工审批

### ColoBot 演进方案

```typescript
// approval.ts 演进为多层漏斗

async function checkApproval(call: ToolCall, ctx: ToolContext): Promise<ApprovalResult> {
  // 第一层：Tirith 规则（同步，零延迟）
  const tirithResult = await tirithCheck(ctx);
  if (tirthResult.decisive) return tirithResult;

  // 第二层：Pattern 匹配（异步，毫秒级）
  const patternResult = await patternCheck(ctx);
  if (patternResult.decisive) return patternResult;

  // 第三层：Smart LLM（异步，秒级，有判断理由）
  const llmResult = await smartLlmCheck(ctx);
  return llmResult;
}

// 审批结果
interface ApprovalResult {
  decisive: boolean;   // true = 结论已定，false = 需下一层
  action: 'allow' | 'block' | 'pending';
  reason?: string;     // 给审计用
  level?: number;      // 触发了哪一层
}
```

**规则示例**（`tirith`）：

```json
{
  "rules": [
    { "tool": "exec_code", "roles": ["admin"], "action": "allow" },
    { "tool": "send_message", "ip_whitelist": ["10.0.0.0/8"], "action": "allow" },
    { "tool": "delete_agent", "action": "block" }
  ]
}
```

**收益**：
- 高频合法操作（search_memory、get_time）第一层 Tirith 直接过，无延迟
- 误拦率大幅降低（只有真正可疑的操作才到 LLM 层）
- 审批理由透明（每层都有判断依据进审计日志）

---

## 三、长期：Context Compression（支持超长会话）

### 现状

ColoBot 每次 `runAgent` 把完整 history + system prompt 传给 LLM：

```typescript
// runtime.ts
const messages: LLMMessage[] = [
  ...history.map(h => ({ role: h.role, content: h.content })),
  { role: 'user', content: userMessage },
];
// 完整历史每次都发
```

没有压缩机制，依赖模型自己的 context window（8K/32K/128K 等）。长会话后期历史占比大，浪费 token。

### hermes 的 Context Compressor

hermes 有 `ContextCompressor`——当 context 快满时，自动压缩历史：

```
原始对话历史（20 条）
    ↓ LLM 摘要（保留关键事实+工具调用记录）
压缩后的摘要历史（3 条）
    ↓ 保留
最新对话（2 条）
```

压缩时：
- 用 LLM 生成摘要：`Summarize this conversation, keeping key facts, decisions, and tool calls`
- 摘要替换原始消息条数（20 条 → 3 条）
- 工具调用记录保留（不可丢失执行轨迹）

### ColoBot 演进方案

```typescript
// context-compressor.ts

interface CompressionResult {
  compressedMessages: LLMMessage[];
  summary: string;           // 摘要文本，可审计追溯
  originalCount: number;       // 原始消息数
  compressedCount: number;    // 压缩后消息数
}

async function compressContext(
  messages: LLMMessage[],
  maxTokens: number,
  model: string
): Promise<CompressionResult> {
  // 1. 估算当前 context 大小
  const currentTokens = await countTokens(messages, model);
  if (currentTokens < maxTokens * 0.7) {
    return { compressedMessages: messages, summary: '', originalCount: messages.length, compressedCount: messages.length };
  }

  // 2. 分离：可压缩段 + 不可压缩段
  const [compressible, keep] = splitMessages(messages);

  // 3. LLM 摘要压缩段
  const summary = await llmSummarize(compressible, model);

  // 4. 重建消息
  const compressedMessages = [
    { role: 'system', content: `[ Earlier context summarized: ${summary} ]` },
    ...keep,
  ];

  return { compressedMessages, summary, originalCount: messages.length, compressedCount: keep.length + 1 };
}
```

**触发时机**：
- 每次 `runAgent` 前检查：`countTokens(history) > maxTokens * 0.7`
- 压缩后历史保留最近 N 条（不可压缩段）+ 摘要（可压缩段）

**收益**：
- 支持超长会话（100+ 轮对话不膨胀）
- Token 成本可控
- 摘要进审计日志，可还原"压缩前说了什么"

---

## 总结

| 方向 | 收益 | 改动范围 |
|---|---|---|
| ToolRegistry + check_fn | 权限细粒度 + 规则自动审批 | tools/executor.ts, runtime.ts |
| 多层审批流 | 减少误拦，提高效率 | approval.ts, 新增 tirith.ts |
| Context Compression | 支持超长会话，控制成本 | 新增 context-compressor.ts, 改动 runtime.ts |

三层演进互不依赖，可按优先级渐进引入。
