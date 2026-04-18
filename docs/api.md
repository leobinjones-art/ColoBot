# API Reference

Base URL: `http://localhost:18792`

All authenticated endpoints require `Authorization: Bearer <API_KEY>` header.

---

## Agents

### List Agents

```
GET /api/agents
```

Returns all agents.

```bash
curl http://localhost:18792/api/agents \
  -H "Authorization: Bearer $API_KEY"
```

```json
[
  { "id": "uuid", "name": "MyAgent", "createdAt": "..." }
]
```

---

### Create Agent

```
POST /api/agents
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Agent name |
| `soul_content` | string | JSON soul definition |
| `primary_model_id` | string | e.g. `openai:gpt-4o` |
| `fallback_model_id` | string | Fallback model |
| `temperature` | number | LLM temperature |
| `max_tokens` | number | Max response tokens |
| `system_prompt_override` | string | Override system prompt |

```bash
curl -X POST http://localhost:18792/api/agents \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Researcher",
    "soul_content": "{\"role\": \"研究员\", \"personality\": \"你是一个严谨的学术研究员\"}",
    "primary_model_id": "openai:gpt-4o"
  }'
```

```json
{ "id": "uuid", "name": "Researcher", "primaryModelId": "openai:gpt-4o", ... }
```

---

### Get Agent

```
GET /api/agents/:id
```

```bash
curl http://localhost:18792/api/agents/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $API_KEY"
```

---

### Delete Agent

```
DELETE /api/agents/:id
```

```bash
curl -X DELETE http://localhost:18792/api/agents/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $API_KEY"
```

Returns `204 No Content`.

---

### Import OpenClaw SOUL.md

```
POST /api/agents/import
```

Parse and optionally create from an OpenClaw SOUL.md file.

| Field | Type | Description |
|-------|------|-------------|
| `markdown` | string | SOUL.md content (mutually exclusive with `url`) |
| `url` | string | URL to fetch SOUL.md from (mutually exclusive with `markdown`) |
| `name` | string | Agent name override |
| `create` | boolean | Whether to create the agent (default: false) |
| `primary_model_id` | string | Model for created agent |
| `fallback_model_id` | string | Fallback model for created agent |

```bash
curl -X POST http://localhost:18792/api/agents/import \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/agent.soul.md",
    "name": "MyAgent",
    "create": true,
    "primary_model_id": "openai:gpt-4o"
  }'
```

---

## Chat

### Send Message

```
POST /api/chat
```

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | string | Target agent ID |
| `session_key` | string | Conversation session key |
| `message` | string \| ContentBlock[] | Message content |

If a Skill is triggered by the message (trigger word match), the Skill executes instead of the Agent. Otherwise, the Agent processes the message.

When a dangerous tool requires approval, returns `202 Accepted` with `{ pending: true, approvalId }`.

```bash
curl -X POST http://localhost:18792/api/chat \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "550e8400-e29b-41d4-a716-446655440000",
    "session_key": "session-1",
    "message": "你好，请介绍一下自己"
  }'
```

```json
{ "response": "你好！我是..." }
```

---

### WebSocket Chat

```
ws://localhost:18792?api_key=<API_KEY>&agent_id=<AGENT_ID>&session=<SESSION_KEY>
```

Send JSON:

```json
{
  "type": "chat",
  "payload": { "message": "Hello" }
}
```

Receive JSON responses:
- `{ "type": "response", "payload": { "response": "..." } }` — final response
- `{ "type": "error", "payload": { "error": "..." } }` — error

---

## Memory

### Search Memory

```
POST /api/memory/search
```

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | string | Agent ID to search within |
| `query` | string | Semantic search query |

```bash
curl -X POST http://localhost:18792/api/memory/search \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "550e8400-e29b-41d4-a716-446655440000",
    "query": "用户的名字"
  }'
```

---

## Search

### SearXNG Search

```
POST /api/search
```

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | Search query |
| `safe_search` | number | 0=off, 1=moderate, 2=strict |
| `time_range` | string | `day`, `week`, `month`, `year` |

```bash
curl -X POST http://localhost:18792/api/search \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "ColoBot AI agent framework",
    "safe_search": 1
  }'
```

```json
{
  "results": [...],
  "numberOfResults": 10
}
```

---

## Skills

### List Skills

```
GET /api/skills
```

```bash
curl http://localhost:18792/api/skills \
  -H "Authorization: Bearer $API_KEY"
```

### Create Skill

```
POST /api/skills
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Skill name |
| `description` | string | Human-readable description |
| `markdown_content` | string | Markdown skill definition |
| `trigger_words` | string[] | Trigger words array |
| `trigger_config` | object | Trigger configuration |

```bash
curl -X POST http://localhost:18792/api/skills \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "EchoSkill",
    "description": "Echo back user input",
    "markdown_content": "# EchoSkill\n\n## 触发词\necho\n\n## 描述\n简单回声技能\n\n## 执行工具序列\nget_time\n",
    "trigger_words": ["echo"]
  }'
```

---

## Knowledge

### List Knowledge

```
GET /api/knowledge?category=concept|template|rule
```

### Add Knowledge

```
POST /api/knowledge
```

| Field | Type | Description |
|-------|------|-------------|
| `category` | string | `concept`, `template`, or `rule` |
| `name` | string | Entry name |
| `content` | string | Content text |
| `variables` | string[] | Variable names (for templates) |
| `related` | string[] | Related entry names |

### Search Knowledge

```
POST /api/knowledge/search
```

### Get / Delete Single Entry

```
GET  /api/knowledge/:category/:name
DELETE /api/knowledge/:category/:name
```

### Batch Import

```
POST /api/knowledge/import
```

```bash
curl -X POST http://localhost:18792/api/knowledge/import \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      { "category": "concept", "name": "弹性伸缩", "content": "..." },
      { "category": "rule", "name": "安全审计", "content": "..." }
    ]
  }'
```

---

## Triggers

### Fire Webhook Trigger

```
POST /api/triggers/fire
```

| Field | Type | Description |
|-------|------|-------------|
| `trigger_id` | string | Trigger ID |
| `payload` | object | Payload passed to the trigger |

### Fire Condition Trigger

```
POST /api/triggers/condition-fire
```

| Field | Type | Description |
|-------|------|-------------|
| `trigger_id` | string | Trigger ID |
| `context` | object | Context object for condition evaluation |

---

## Approvals

### List Pending Approvals

```
GET /api/approvals?agent_id=<AGENT_ID>
```

### Approve Request

```
POST /api/approvals/:id/approve
```

| Field | Type | Description |
|-------|------|-------------|
| `approver` | string | Approver name (default: `system`) |
| `result` | object | Result data passed to continue execution |

### Reject Request

```
POST /api/approvals/:id/reject
```

| Field | Type | Description |
|-------|------|-------------|
| `approver` | string | Approver name |
| `reason` | string | Rejection reason |

---

## Audit

### Query Audit Logs

```
GET /api/audit?action=&from=&to=&limit=&offset=
```

| Param | Type | Description |
|-------|------|-------------|
| `action` | string | Filter by action (e.g. `agent.create`) |
| `from` | ISO date | Start time |
| `to` | ISO date | End time |
| `limit` | number | Max results (default: 50) |
| `offset` | number | Pagination offset |

---

## Tools

### List All Tools

```
GET /api/tools
```

Returns the full tool registry including dangerous tools and their RBAC requirements.

---

## Settings

### Feishu Settings

```
GET    /api/settings/feishu
PUT    /api/settings/feishu
```

### SubAgent Settings

```
GET    /api/settings/subagent
PUT    /api/settings/subagent
```

| Field | Type | Description |
|-------|------|-------------|
| `allowedTools` | string[] | Tool whitelist (null = all allowed) |
| `blockedTools` | string[] | Tool blacklist |
| `defaultTtlMs` | number | Default TTL in ms (default: 300000) |

### SearXNG Settings

```
GET    /api/settings/searxng
PUT    /api/settings/searxng
```

### LLM Settings

```
GET    /api/settings/llm
PUT    /api/settings/llm
```

### Notification Settings

```
GET    /api/settings/notifications
PUT    /api/settings/notifications
```

---

## SOP (Academic Workflows)

### Get SOP Progress

```
GET /api/sop/:agentId/:sessionKey/progress
```

Returns current SOP state for an agent session. SOPs are academic workflows (thesis, literature review, experiment report) that guide users through structured document creation.

```json
{
  "category": "thesis",
  "sopName": "论文 SOP",
  "currentStep": 3,
  "totalSteps": 7,
  "steps": [...],
  "startedAt": "2026-04-18T..."
}
```

---

## Health

### Health Check

```
GET /health
```

```bash
curl http://localhost:18792/health
```

```json
{ "status": "ok", "ts": "2026-04-18T..." }
```

---

## Error Responses

| Status | Meaning |
|--------|---------|
| `400` | Bad Request — missing or invalid parameters |
| `401` | Unauthorized — invalid or missing API key |
| `404` | Not Found |
| `429` | Rate Limited — retry after `Retry-After` header |
| `500` | Internal Server Error |

Error body:

```json
{ "error": "Error description" }
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/login` | 5 requests | 60s |
| `/api/chat` | 30 requests | 60s |

Rate limit response includes `Retry-After` and `X-RateLimit-*` headers.

---

## Webhooks

### Feishu Events

```
GET  /api/webhooks/feishu?challenge=...  # Challenge verification
POST /api/webhooks/feishu               # Event callback
GET  /api/webhooks/feishu/approve       # Button approval callback
```
