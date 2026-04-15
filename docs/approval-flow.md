# 审批流 (ApprovalFlow)

> 更新日期: 2026-04-15
> 状态: 已实现（待优化）

## 概述

审批流用于控制 Agent 执行**危险操作**，需要管理员确认后才能继续。危险操作包括：

| 操作类型 | 说明 |
|----------|------|
| `update` | 修改数据 |
| `delete` | 删除数据 |
| `exec` | 执行命令/代码 |
| `send` | 发送消息/通知 |

---

## 数据库 Schema

### approval_requests 表

```sql
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  requester VARCHAR(255) NOT NULL,        -- 请求者名称
  action_type VARCHAR(50) NOT NULL,       -- update|delete|exec|send
  target_resource TEXT NOT NULL,           -- 目标资源描述
  description TEXT,                       -- 审批描述
  payload JSONB NOT NULL,                  -- 完整请求上下文（含 channel）
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending|approved|rejected|expired
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,                  -- NULL=永不过期
  decided_at TIMESTAMPTZ,
  approver VARCHAR(255),
  result JSONB DEFAULT '{}'
);

CREATE INDEX idx_approval_status ON approval_requests(status);
CREATE INDEX idx_approval_agent ON approval_requests(agent_id);
```

### pending_conversations 表

保存审批触发时的对话状态，用于审批通过后继续执行。

```sql
CREATE TABLE pending_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL UNIQUE,
  agent_id UUID NOT NULL,
  session_key VARCHAR(255) NOT NULL,
  messages JSONB NOT NULL,                -- LLM 消息历史
  dangerous_calls JSONB NOT NULL,         -- 危险工具调用列表
  current_round INT NOT NULL,             -- 触发审批时的轮次
  allowed_calls JSONB NOT NULL,           -- 已允许的工具调用
  blocked_calls JSONB NOT NULL,           -- 被阻止的工具调用
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pc_approval ON pending_conversations(approval_id);
```

---

## 危险工具定义

定义在 `src/agent-runtime/runtime.ts`：

```typescript
const DANGEROUS_TOOLS: Record<string, ApprovalActionType> = {
  execute_code: 'exec',
  delete_file: 'delete',
  modify_config: 'update',
  send_notification: 'send',
  // ...
};
```

---

## 当前实现流程

```
用户消息 → runAgentStream()
                  │
                  ▼
             LLM 生成工具调用
                  │
      ┌───────────┴───────────┐
      │                       │
 非危险工具              危险工具 (DANGEROUS_TOOLS)
      │                       │
 executeToolCalls()     approvalFlow.create() → DB
      │                       │
      │              savePendingConversation() → DB
      │                       │
      │                       ▼
      │               pushWsDone() → HTTP 返回
      │               { pending: true, approvalId }
      │                       │
      │                       ▼
      │               [等待管理员审批]
      │                       │
      └───────────────────────┘
                  │
                  ▼
      POST /api/approvals/:id/approve
                  │
      ┌───────────┴───────────┐
      │                       │
 approve()              executeApproved()
 → 更新 DB status       → executeToolCalls()
 → 异步 continueRun()   (重复执行工具)
      │
      ▼
 continueRun()
 → executeToolCalls()  (第1次执行)
 → agentChat() 非流式继续
 → pushWsResult() 推送
```

---

## 已知问题

| # | 问题 | 影响 |
|---|------|------|
| 1 | 工具执行两次（`continueRun` + `executeApproved`） | 重复执行，可能有副作用 |
| 2 | `pending_conversations` 未清理 | 多次审批后数据膨胀 |
| 3 | `continueRun` 用非流式 LLM，结果 WebSocket 无人接收 | 用户看不到后续响应 |

详见: [issue: 审批流双重执行问题](https://gitcode.com/Condamnation/ColoBot/issues)

---

## 目标实现流程

```
用户消息 → runAgentStream()
                  │
                  ▼
             LLM 生成工具调用
                  │
      ┌───────────┴───────────┐
      │                       │
 非危险工具              危险工具
      │                       │
 executeToolCalls()     approvalFlow.create() → DB
      │                       │
      └──────┬────────────────┘
             │
             ▼
      savePendingConversation()
             │
             ▼
      pushWsChunk({ pending: true, approvalId, description })
      → 用户看到 "⏳ 等待审批: {description}"
             │
             ▼
           [流结束]

      ── 管理员审批 ──

      POST /api/approvals/:id/approve
             │
             ▼
      approvalFlow.approve() 更新 DB
             │
             ▼
      异步任务（不等待）
      → 读取 pending_conversations
      → 执行危险工具（仅一次）
      → 构建新消息追加到 session
        "管理员已批准 {action_type}，执行结果: {result}"
      → 流式 agentChatStream() 继续对话
      → pushWsChunk() 实时推送 LLM 响应
      → 完成后 DELETE pending_conversations
```

### 关键改进

1. **一次执行**：只审批，工具在审批后执行一次
2. **流式继续**：审批通过后用流式 LLM 继续，实时推送
3. **状态通知**：WebSocket 推送审批状态变化
4. **自动清理**：完成后删除 pending_conversations

---

## API 接口

### 查询待审批

```
GET /api/approvals
GET /api/approvals?agent_id=<uuid>

Response: ApprovalRequest[]
```

### 审批通过

```
POST /api/approvals/:id/approve
Body: { approver?: string, result?: object }

Response: ApprovalRequest & { toolResult?: unknown }
```

### 审批拒绝

```
POST /api/approvals/:id/reject
Body: { approver?: string, reason?: string }

Response: ApprovalRequest
```

### 获取单个审批

```
GET /api/approvals/:id

Response: ApprovalRequest
```

---

## WebSocket 审批通知（待实现）

审批状态变化时，主动推送通知给连接的用户：

```typescript
// 审批通过
{ type: 'approval', action: 'approved', approvalId: '...', toolResult: {...} }

// 审批拒绝
{ type: 'approval', action: 'rejected', approvalId: '...' }

// 审批超时
{ type: 'approval', action: 'expired', approvalId: '...' }
```

---

## 通知渠道（待实现）

| 渠道 | 说明 |
|------|------|
| 飞书 | Webhook 机器人通知 |
| 邮件 | SMTP 发送邮件 |
| Telegram | Bot 推送 |
| Slack | Incoming Webhook |

---

## 审批超时配置

审批请求可设置过期时间：

```typescript
// 创建审批时指定（分钟）
approvalFlow.create({
  // ...
  expiresInMinutes: 30,  // 30分钟后自动过期
});
```

过期后 status 变为 `expired`，可通过 `approvalFlow.expireOld()` 批量处理。

---

## 审计

所有审批操作都会写入审计日志：

| 事件 | 说明 |
|------|------|
| `approval.requested` | 审批请求创建 |
| `approval.approved` | 审批通过 |
| `approval.rejected` | 审批拒绝 |
| `approval.expired` | 审批过期 |
| `tool.execute` | 工具执行（危险工具） |
| `tool.blocked` | 工具被阻止 |
