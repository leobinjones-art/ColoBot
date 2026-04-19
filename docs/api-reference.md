# ColoBot API 文档

## 目录

- [概述](#概述)
- [认证](#认证)
- [基础URL](#基础url)
- [通用响应格式](#通用响应格式)
- [错误处理](#错误处理)
- [API端点](#api端点)
  - [智能体管理](#智能体管理)
  - [对话接口](#对话接口)
  - [记忆系统](#记忆系统)
  - [知识库](#知识库)
  - [Skill管理](#skill管理)
  - [Trigger管理](#trigger管理)
  - [审批流程](#审批流程)
  - [审计日志](#审计日志)
  - [系统设置](#系统设置)
  - [搜索服务](#搜索服务)

---

## 概述

ColoBot API 提供了完整的智能体管理和协作功能。支持多模态输入输出、Skill编排、自动审批流程等功能。

**版本**: v0.1.0  
**协议**: HTTP/1.1, WebSocket  
**数据格式**: JSON

---

## 认证

所有API请求（除登录接口外）都需要API密钥认证。

### 获取API密钥

1. **环境变量方式**: 设置 `COLOBOT_API_KEY` 环境变量
2. **命令行方式**: 启动时使用 `--api-keys` 参数
3. **交互式输入**: 启动时未设置密钥会提示输入

### 使用API密钥

在请求头中添加 `Authorization` 字段：

```http
Authorization: Bearer YOUR_API_KEY
```

### 登录接口

```http
POST /api/login
Content-Type: application/json

{
  "key": "YOUR_API_KEY"
}
```

**响应**:
```json
{
  "ok": true
}
```

---

## 基础URL

```
http://localhost:18792
```

生产环境请替换为实际域名。

---

## 通用响应格式

### 成功响应

```json
{
  "id": "item-123",
  "name": "Example",
  "created_at": "2026-04-19T10:00:00Z"
}
```

### 错误响应

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## 错误处理

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 204 | 成功（无内容） |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

---

## API端点

### 智能体管理

#### 列出所有智能体

```http
GET /api/agents
Authorization: Bearer YOUR_API_KEY
```

**响应**:
```json
[
  {
    "id": "agent-123",
    "name": "开发助手",
    "soul_content": "你是一个专业的软件开发助手",
    "primary_model_id": "openai:gpt-4o-mini",
    "fallback_model_id": "anthropic:claude-sonnet",
    "temperature": 0.7,
    "max_tokens": 4096,
    "created_at": "2026-04-19T10:00:00Z"
  }
]
```

#### 创建智能体

```http
POST /api/agents
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "name": "开发助手",
  "soul_content": "你是一个专业的软件开发助手",
  "primary_model_id": "openai:gpt-4o-mini",
  "fallback_model_id": "anthropic:claude-sonnet",
  "temperature": 0.7,
  "max_tokens": 4096
}
```

**响应**: 返回创建的智能体对象（状态码 201）

#### 获取单个智能体

```http
GET /api/agents/{id}
Authorization: Bearer YOUR_API_KEY
```

**响应**: 返回智能体对象

#### 删除智能体

```http
DELETE /api/agents/{id}
Authorization: Bearer YOUR_API_KEY
```

**响应**: 状态码 204

#### 导入OpenClaw SOUL

```http
POST /api/agents/import
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "soul_markdown": "# Agent Name\n\n## Soul\nYou are a helpful assistant."
}
```

**响应**: 返回创建或匹配的智能体对象

---

### 对话接口

#### 发送消息

```http
POST /api/chat
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "agent_id": "agent-123",
  "session_key": "session-abc",
  "message": "你好，请帮我写一个函数",
  "stream": false
}
```

**参数说明**:
- `agent_id`: 智能体ID（必需）
- `session_key`: 会话键（可选，默认为 "default"）
- `message`: 用户消息（必需）
- `stream`: 是否流式返回（可选，默认 false）

**响应（非流式）**:
```json
{
  "content": "好的，我来帮你写一个函数...",
  "tool_calls": []
}
```

**响应（流式）**:
返回 `text/event-stream` 格式的流式数据。

---

### 记忆系统

#### 搜索记忆

```http
POST /api/memory/search
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "agent_id": "agent-123",
  "query": "之前的对话内容",
  "limit": 10
}
```

**响应**:
```json
[
  {
    "id": "memory-123",
    "content": "对话内容",
    "similarity": 0.85,
    "created_at": "2026-04-19T10:00:00Z"
  }
]
```

---

### 知识库

#### 列出知识条目

```http
GET /api/knowledge?category=concept
Authorization: Bearer YOUR_API_KEY
```

**参数**:
- `category`: 知识类别（可选，值: `concept`, `template`, `rule`）

**响应**:
```json
[
  {
    "id": "knowledge-123",
    "category": "concept",
    "name": "K8s Deployment",
    "content": "Kubernetes 部署配置模板",
    "variables": ["image", "replicas", "port"],
    "related": ["docker-build"],
    "created_at": "2026-04-19T10:00:00Z"
  }
]
```

#### 添加知识条目

```http
POST /api/knowledge
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "category": "concept",
  "name": "K8s Deployment",
  "content": "Kubernetes 部署配置模板，用于快速创建 Deployment。",
  "variables": ["image", "replicas", "port"],
  "related": ["docker-build", "helm-template"]
}
```

**响应**: 返回创建的知识条目对象（状态码 201）

#### 搜素知识

```http
POST /api/knowledge/search
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "query": "K8s",
  "category": "concept"
}
```

**响应**: 返回匹配的知识条目数组

#### 获取单个知识条目

```http
GET /api/knowledge/{category}/{name}
Authorization: Bearer YOUR_API_KEY
```

**响应**: 返回知识条目对象

#### 删除知识条目

```http
DELETE /api/knowledge/{category}/{name}
Authorization: Bearer YOUR_API_KEY
```

**响应**: 状态码 204

#### 批量导入知识

```http
POST /api/knowledge/import
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "entries": [
    {
      "category": "concept",
      "name": "弹性伸缩",
      "content": "HPA 配置规则..."
    },
    {
      "category": "rule",
      "name": "安全审计",
      "content": "所有操作必须记录审计日志"
    }
  ]
}
```

**响应**: 返回导入结果统计

---

### Skill管理

#### 列出Skills

```http
GET /api/skills
Authorization: Bearer YOUR_API_KEY
```

**响应**:
```json
[
  {
    "id": "skill-123",
    "name": "代码审查",
    "description": "自动审查代码质量",
    "trigger_words": ["review", "代码审查"],
    "enabled": true,
    "created_at": "2026-04-19T10:00:00Z"
  }
]
```

#### 创建Skill

```http
POST /api/skills
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "name": "代码审查",
  "description": "自动审查代码质量",
  "markdown_content": "# 代码审查\n\n## 功能\n自动审查代码质量\n\n## 触发词\nreview, 代码审查",
  "trigger_words": ["review", "代码审查"],
  "enabled": true
}
```

**响应**: 返回创建的Skill对象（状态码 201）

---

### Trigger管理

#### 触发Webhook Trigger

```http
POST /api/triggers/fire
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "trigger_id": "trigger-123",
  "payload": {
    "event": "webhook_event",
    "data": {}
  }
}
```

**响应**:
```json
{
  "success": true,
  "result": "Trigger executed successfully"
}
```

---

### 审批流程

#### 获取审批请求列表

```http
GET /api/approvals
Authorization: Bearer YOUR_API_KEY
```

**响应**:
```json
[
  {
    "id": "approval-123",
    "agent_id": "agent-123",
    "requester": "user-456",
    "action_type": "exec",
    "target_resource": "dangerous_tool",
    "description": "执行危险操作",
    "status": "pending",
    "created_at": "2026-04-19T10:00:00Z",
    "expires_at": "2026-04-19T10:10:00Z"
  }
]
```

#### 审批通过

```http
POST /api/approvals/{id}/approve
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "result": {
    "approved": true,
    "reason": "操作安全"
  }
}
```

**响应**: 返回更新后的审批请求对象

#### 审批拒绝

```http
POST /api/approvals/{id}/reject
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "reason": "操作过于危险"
}
```

**响应**: 返回更新后的审批请求对象

---

### 审计日志

#### 查询审计日志

```http
GET /api/audit?limit=100&offset=0
Authorization: Bearer YOUR_API_KEY
```

**参数**:
- `limit`: 返回数量（可选，默认100）
- `offset`: 偏移量（可选，默认0）
- `actor_type`: 操作者类型（可选）
- `action`: 操作类型（可选）
- `start_date`: 开始日期（可选）
- `end_date`: 结束日期（可选）

**响应**:
```json
[
  {
    "id": "audit-123",
    "actor_type": "user",
    "actor_name": "admin",
    "action": "agent.create",
    "target_type": "agent",
    "target_id": "agent-123",
    "target_name": "开发助手",
    "ip_address": "192.168.1.1",
    "result": "success",
    "created_at": "2026-04-19T10:00:00Z"
  }
]
```

---

### 系统设置

#### 获取飞书配置

```http
GET /api/settings/feishu
Authorization: Bearer YOUR_API_KEY
```

**响应**:
```json
{
  "app_id": "cli_xxxxxxxxxxxxxx",
  "app_secret": "xxxxxxxxxxxxxxxx",
  "verification_token": "xxxxxxxx",
  "approver_open_id": "ou_xxxxxxxx",
  "public_url": "https://your-domain.com"
}
```

#### 更新飞书配置

```http
PUT /api/settings/feishu
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "app_id": "cli_xxxxxxxxxxxxxx",
  "app_secret": "xxxxxxxxxxxxxxxx",
  "approver_open_id": "ou_xxxxxxxx"
}
```

**响应**: 返回更新后的配置对象

#### 获取SubAgent配置

```http
GET /api/settings/subagent
Authorization: Bearer YOUR_API_KEY
```

**响应**:
```json
{
  "default_ttl_minutes": 60,
  "max_concurrent": 10,
  "allowed_tools": ["search", "read_file"]
}
```

#### 更新SubAgent配置

```http
PUT /api/settings/subagent
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "default_ttl_minutes": 120,
  "max_concurrent": 20
}
```

**响应**: 返回更新后的配置对象

---

### 搜索服务

#### SearXNG搜索

```http
POST /api/search
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "query": "TypeScript best practices",
  "engines": ["google", "bing"],
  "categories": ["general"],
  "limit": 10
}
```

**响应**:
```json
{
  "results": [
    {
      "title": "TypeScript Best Practices",
      "url": "https://example.com/article",
      "snippet": "Learn TypeScript best practices...",
      "engines": ["google"]
    }
  ],
  "total": 10
}
```

---

### 工具列表

#### 获取所有工具

```http
GET /api/tools
Authorization: Bearer YOUR_API_KEY
```

**响应**:
```json
[
  {
    "name": "search",
    "description": "搜索网络信息",
    "parameters": {
      "query": {
        "type": "string",
        "description": "搜索查询"
      }
    },
    "requires_approval": false
  },
  {
    "name": "exec_code",
    "description": "执行代码",
    "parameters": {
      "code": {
        "type": "string",
        "description": "要执行的代码"
      }
    },
    "requires_approval": true
  }
]
```

---

### 飞书集成

#### 飞书事件回调

```http
POST /api/webhooks/feishu
Content-Type: application/json
X-Lark-Signature: xxx
X-Lark-Timestamp: 1234567890
X-Lark-Nonce: abc123

{
  "type": "event_callback",
  "event": {
    "type": "message",
    "content": "用户消息"
  }
}
```

**响应**: 根据事件类型返回相应结果

#### 飞书审批回调

```http
GET /api/webhooks/feishu/approve?approval_id=approval-123&action=approve
```

**响应**: 重定向到审批结果页面

---

### 健康检查

```http
GET /health
```

**响应**:
```json
{
  "status": "ok",
  "timestamp": "2026-04-19T10:00:00Z"
}
```

---

## WebSocket接口

### 连接

```
ws://localhost:18792?agent_id=agent-123&session=session-abc&api_key=YOUR_API_KEY
```

### 消息格式

#### 发送消息

```json
{
  "type": "chat",
  "payload": {
    "message": "你好"
  }
}
```

#### 接收响应

```json
{
  "type": "response",
  "payload": {
    "content": "你好！有什么可以帮助你的吗？"
  }
}
```

#### 流式响应

```json
{
  "type": "chunk",
  "payload": {
    "content": "你",
    "done": false
  }
}
```

```json
{
  "type": "chunk",
  "payload": {
    "content": "好",
    "done": false
  }
}
```

```json
{
  "type": "done",
  "payload": {}
}
```

---

## 速率限制

API请求受速率限制：

| 端点 | 限制 | 时间窗口 |
|------|------|----------|
| `/api/login` | 5次 | 60秒 |
| `/api/chat` | 100次 | 60秒 |
| 其他端点 | 1000次 | 60秒 |

超出限制时返回 429 状态码。

---

## 最佳实践

### 1. 错误处理

始终检查响应状态码和错误信息：

```javascript
try {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ agent_id: 'agent-123', message: 'Hello' })
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('API Error:', error.error);
    return;
  }

  const data = await response.json();
  console.log('Response:', data);
} catch (error) {
  console.error('Network Error:', error);
}
```

### 2. 流式响应

对于长时间运行的任务，使用流式响应：

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    agent_id: 'agent-123',
    message: 'Write a long article',
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  console.log('Chunk:', chunk);
}
```

### 3. WebSocket连接

使用WebSocket进行实时通信：

```javascript
const ws = new WebSocket(`ws://localhost:18792?agent_id=agent-123&api_key=${apiKey}`);

ws.onopen = () => {
  console.log('WebSocket connected');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

ws.send(JSON.stringify({
  type: 'chat',
  payload: { message: 'Hello' }
}));
```

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1.0 | 2026-04-19 | 初始版本 |

---

## 支持

如有问题，请通过以下方式获取帮助：

- 📖 [文档](../README.md)
- 🐛 [问题跟踪](https://github.com/leobinjones-art/ColoBot/issues)
- 💬 [讨论区](https://github.com/leobinjones-art/ColoBot/discussions)