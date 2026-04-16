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
                  ▼
      approvalFlow.approve()
      → 更新 DB status = 'approved'
      → 异步触发 continueRun()
                  │
                  ▼
      continueRun() [异步执行]
      → 从 pending_conversations 读取状态
      → executeToolCalls() 执行危险工具（仅一次）
      → agentChatStream() 流式继续 LLM 对话
      → pushWsChunk() 实时推送 LLM 响应
      → pushWsDone() 结束流
      → DELETE pending_conversations
```

---

## 已知问题（已修复）

| # | 问题 | 状态 | 修复版本 |
|---|------|------|----------|
| 1 | 工具执行两次 | ✅ 已修复 | v0.1.x |
| 2 | `pending_conversations` 未清理 | ✅ 已在 continueRun 末尾清理 | v0.1.x |
| 3 | continueRun 用非流式 LLM | ✅ 已改用 agentChatStream() | v0.1.x |

---

## 待优化项

以下功能**已全部实现** ✅：

1. ✅ **聊天内审批**：用户说"批准 #approvalId"/"approve #xxx" 触发审批
2. ✅ **WebSocket 审批通知**：审批状态变化时推送 `{ type: 'approval', payload: { action, approvalId } }`
3. ✅ **外部通知渠道**：飞书 Webhook / nodemailer / Telegram Bot（需配置环境变量）
4. ✅ **审批结果消息**：审批通过后追加详细执行结果消息到 session

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

## WebSocket 审批通知

审批状态变化时，主动推送通知给连接的用户：

```typescript
// 审批通过
{ type: 'approval', payload: { action: 'approved', approvalId: '...' } }

// 审批拒绝
{ type: 'approval', payload: { action: 'rejected', approvalId: '...' } }

// 审批超时
{ type: 'approval', payload: { action: 'expired', approvalId: '...' } }
```

---

## 通知渠道

可通过环境变量启用以下渠道（需同时配置相关凭据）：

| 渠道 | 环境变量 | 说明 |
|------|----------|------|
| 飞书 | `FEISHU_WEBHOOK_URL` | 飞书机器人 Webhook URL |
| 邮件 | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_TO` | SMTP 发邮件（需 `npm i nodemailer`） |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Telegram Bot 推送 |

所有渠道均**无需安装额外依赖**（飞书/Telegram 使用原生 fetch），邮件需 `npm i nodemailer`。

文件: `src/services/notifications.ts`

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
