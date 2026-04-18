# ColoBot Dashboard Manual

Access: `http://<server-ip>:18792/`

---

## Login

No API Key required in dev mode — just click the Login button to enter.

---

## Top Navigation

Click a tab to switch between modules.

---

## Feishu

Configure connection to Feishu (Lark) bot. Two methods are supported:

### Method B（Recommended）- Application Bot

| Field | Description |
|-------|-------------|
| App ID | Feishu App ID, format `cli_xxxxxxxx` |
| App Secret | Feishu App Secret |
| Approver Open ID | Approver Open ID, format `ou_xxxxxxxx` |
| Callback URL | **Fill this URL in Feishu Open Platform backend** |
| Verification Token | Verification Token for Feishu event subscription |

### Method A（Legacy）- Webhook

Paste the Feishu bot Webhook URL directly. Compatible with older setups.

Click **Save Settings** after configuration.

---

## Models

Manage Agent model configurations.

### Create Agent

Click **+ Create Agent**, fill in:

- **Name**: Agent name
- **Primary Model ID**: Primary model ID (e.g. `gpt-4o`)
- **Fallback Model ID**: Fallback model chain, comma-separated, format `anthropic:claude-sonnet-4-20250514,openai:gpt-4o-mini`
- **Temperature**: Temperature parameter, 0-2, default 0.7

### Delete Agent

Click **Delete** on the corresponding row.

---

## Skills

Create and manage custom Agent skills.

### Create Skill

Click **+ Create Skill**, fill in:

- **Name**: Skill name
- **Description**: What this skill does
- **Trigger Words**: Trigger phrases (JSON array, e.g. `["写论文", "literature review"]`)
- **Markdown Content**: Skill content in Markdown format

### View Skill

Click **View** on the corresponding row.

---

## Knowledge

Manage knowledge base entries. Filter by category (Concept / Template / Rule).

### Add Entry

Click **+ Add Entry**, fill in:

- **Category**: Concept / Template / Rule
- **Name**: Entry name
- **Content**: Knowledge content
- **Variables**: Variable list (JSON array)
- **Related**: Related entries (JSON array)

### Import JSON

Click **Import JSON**, paste a JSON array for bulk import:

```json
[
  { "category": "concept", "name": "Entry Name", "content": "Content here" }
]
```

### View / Delete

- **View**: View full entry details
- **Del**: Delete entry

---

## Approvals

View and process pending approval requests for dangerous tool execution.

### Filter by Status

Dropdown: All / Pending / Approved / Rejected

### Handle Requests

- **Approve**: Approve dangerous tool execution
- **Reject**: Reject with optional reason
- **View**: View full approval details

---

## Audit

Detailed operation logs.

### Filter by Action Type

Dropdown filters include:

| Action | Description |
|--------|-------------|
| `agent.create` | Agent created |
| `agent.delete` | Agent deleted |
| `approval.approved` | Approval granted |
| `approval.rejected` | Approval denied |
| `tool.execute` | Tool executed |

### Display

Each log entry shows: Time, Actor, Action, Target, Result, Detail

---

## SubAgent

Control sub-Agent tool permissions.

### Tool Whitelist / Blacklist

- **Allowed Tools**: JSON array, only these tools may execute (e.g. `["spawn_subagent", "add_memory"]`)
- **Blocked Tools**: JSON array, these tools are always denied (e.g. `["delete_file", "execute_code"]`)

Leave empty for no restrictions. When both are set, whitelist takes priority.

### Default TTL

SubAgent default lifetime in milliseconds. Default 300000 (5 minutes).

---

## SOP

View academic SOP (Standard Operating Procedure) progress for papers, literature reviews, and experiment reports.

### How to View

1. Select the **Agent**
2. Enter the **session key** (conversation session identifier)
3. Click **View**

Shows: SOP type, current step / total steps, start time, completed steps list.

---

## Search

Configure private SearXNG search instance.

### Instance URL

SearXNG instance URL:

- Local: `http://127.0.0.1:8080`
- Public: `https://search.anoni.net`

### Test Connection

Click **Test Connection** to verify the configuration works.

---

## LLM

Configure LLM provider and API keys.

### Provider & Mode

- **Provider**: OpenAI / Anthropic / MiniMax
- **Mock Mode**: Enable to skip real API calls (for testing)

### API Keys

Fill in the API key for your selected provider (leave empty to use env var).

---

## Notifications

Configure multi-channel notifications.

### Webhook

- **Message Webhook**: General webhook URL
- **Feishu Webhook**: Feishu bot Webhook URL

### Email (SMTP)

Fill in SMTP server details (Host / Port / User / Password / From / To).

### Telegram

Fill in Bot Token and Chat ID.

---

## Keyboard & Mouse Shortcuts

| Action | How |
|--------|-----|
| Refresh current tab | Click the tab title or its Refresh button |
| Close modal | Click outside the modal or the × button |
| Toast notification | Bottom-right corner, auto-dismisses after 3s |
