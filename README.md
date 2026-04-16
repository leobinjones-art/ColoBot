# ColoBot

> 单智能体 + 子智能体协作平台 — 多模态 AI + Skill 编排 + 飞书审批通知

---

## 核心功能

| 模块 | 功能 | 状态 |
|------|------|------|
| **智能体** | 父Agent（全模态：文本/图片/音频/视频） | ✅ |
| | 子智能体（TTL 自动过期，工具白名单） | ✅ |
| | 消息路由 / 会话管理 | ✅ |
| **Trigger + Skill** | Trigger 引擎（cron/interval/webhook/condition） | ✅ |
| | Markdown Skill 定义 + 触发词激活 | ✅ |
| | Skill 自进化（提案→审批→应用） | ✅ |
| **AI 自进化** | Soul 自进化（对话中学习新能力） | ✅ |
| **搜索** | SearXNG 多模态搜索 | ✅ |
| **记忆** | 向量语义检索 + 文本混合检索 | ✅ |
| **审批** | ApprovalFlow（飞书卡片 + Dashboard） | ✅ |
| **飞书接入** | 交互式卡片 + 快捷审批按钮 | ✅ |
| **审计** | 操作审计日志 + API 查询 | ✅ |
| **Dashboard** | 飞书配置 / 模型 / Skill / 审批 / 审计 | ✅ |
| **Fallback** | 链式 fallback + 跨 provider + 重试 | ✅ |
| **钉钉接入** | 规划中 | 📋 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Node.js 22+ (TypeScript, ESM) |
| 数据库 | PostgreSQL + pgvector |
| LLM | OpenAI / Anthropic / MiniMax |
| 搜索 | SearXNG |
| 前端 | 单文件 HTML（无框架，零依赖） |
| 渠道 | 飞书 Bot（方案 B）|
| 认证 | API Key |

---

## 快速开始

```bash
# 克隆
git clone https://gitcode.com/Condamnation/colobot.git
cd colobot

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# 启动 PostgreSQL（需 pgvector 扩展）
docker compose up -d postgres

# 初始化数据库
npm run db:init

# 启动 ColoBot
npm run dev
```

访问 `http://localhost:18792` 打开 Dashboard。

> **注意**：需使用带 pgvector 扩展的 PostgreSQL 镜像（如 `pgvector/pgvector:pg18`）。

---

## 项目结构

```
colobot/
├── src/
│   ├── colobot-server.ts      # HTTP + WebSocket 入口 + 静态文件
│   ├── agent-runtime/         # 智能体运行时
│   │   ├── runtime.ts        # 消息路由 + LLM 循环
│   │   ├── sub-agents.ts    # 子智能体管理
│   │   ├── approval.ts      # 审批流
│   │   ├── skill-runtime.ts  # Skill 执行
│   │   ├── trigger-runtime.ts # Trigger 引擎
│   │   └── tools/           # 工具注册（executor/memory/minimax-*/subagent）
│   ├── agents/               # Agent 管理（registry）
│   ├── llm/                 # LLM 抽象层（OpenAI/Anthropic/MiniMax + Fallback）
│   ├── memory/              # 向量 + 文本检索
│   ├── middleware/          # 认证中间件
│   ├── routes/              # 飞书回调路由
│   ├── services/           # 审计/通知/设置
│   ├── channels/            # WebSocket 通道
│   └── dashboard/           # 单文件 Dashboard（index.html）
├── sql/
│   └── schema.sql           # 数据库 schema
└── docs/
    └── approval-flow.md     # 审批流设计文档
```

---

## API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/agents` | GET/POST | 列出/创建 Agent |
| `/api/agents/:id` | GET/DELETE | 获取/删除单个 Agent |
| `/api/chat` | POST | 发送消息 |
| `/api/memory/search` | POST | 记忆语义搜索 |
| `/api/search` | POST | SearXNG 搜索 |
| `/api/skills` | GET/POST | 列出/创建 Skill |
| `/api/knowledge` | GET | 获取知识库（?category=concept/template/rule） |
| `/api/knowledge` | POST | 添加知识条目 |
| `/api/knowledge/search` | POST | 搜索知识 |
| `/api/knowledge/:category/:name` | GET/DELETE | 获取/删除单条 |
| `/api/knowledge/import` | POST | 批量导入 JSON |
| `/api/triggers/fire` | POST | 触发 Webhook Trigger |
| `/api/approvals` | GET | 获取审批请求 |
| `/api/approvals/:id/approve` | POST | 审批通过 |
| `/api/approvals/:id/reject` | POST | 审批拒绝 |
| `/api/audit` | GET | 审计日志查询 |
| `/api/tools` | GET | 列出所有工具 |
| `/api/settings/feishu` | GET/PUT | 飞书配置读写 |
| `/api/settings/subagent` | GET/PUT | SubAgent 配置读写 |
| `/api/webhooks/feishu` | GET/POST | 飞书事件回调 |
| `/api/webhooks/feishu/approve` | GET | 飞书按钮审批回调 |
| `/health` | GET | 健康检查 |

---

## 知识库调用示例

### 添加知识条目

```bash
curl -X POST http://localhost:18792/api/knowledge \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "concept",
    "name": "K8s Deployment",
    "content": "Kubernetes 部署配置模板，用于快速创建 Deployment。",
    "variables": ["image", "replicas", "port"],
    "related": ["docker-build", "helm-template"]
  }'
```

### 列出知识库

```bash
# 全部
curl http://localhost:18792/api/knowledge -H "Authorization: Bearer $API_KEY"

# 只看 rule
curl "http://localhost:18792/api/knowledge?category=rule" \
  -H "Authorization: Bearer $API_KEY"
```

### 搜索

```bash
curl -X POST http://localhost:18792/api/knowledge/search \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "K8s", "category": "concept"}'
```

### 批量导入

```bash
curl -X POST http://localhost:18792/api/knowledge/import \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      {"category": "concept", "name": "弹性伸缩", "content": "HPA 配置规则..."},
      {"category": "rule", "name": "安全审计", "content": "所有操作必须记录审计日志"},
      {"category": "template", "name": "服务部署", "content": "标准部署流程模板", "variables": ["env", "image"]}
    ]
  }'
```

### Agent 工具调用

Agent 可直接调用以下工具，无需手动操作：

```xml
<tool_call>
add_knowledge(category: 'concept', name: 'XXX', content: '...', variables: ['x'], related: [])
</tool_call>

<tool_call>
search_knowledge(query: '部署', category: 'concept')
</tool_call>

<tool_call>
list_knowledge(category: 'rule')
</tool_call>
```

---

## 核心设计

### Fallback 链

```
primary model → fallback1 → fallback2 → ...
anthropic:claude-xxx,openai:gpt-4o-mini
支持跨 provider，自动重试 + exponential backoff
```

### 审批流

```
危险工具触发 → 创建审批 → 飞书卡片通知（含批准/拒绝按钮）
                                    ↓
用户点击按钮 → /api/webhooks/feishu/approve → approvalFlow.approve()
                                    ↓
                         危险工具执行 → LLM 继续对话
```

### Trigger 持久化

```
每次触发后：计算 next_fire_at → 持久化到 DB
重启时：检查 next_fire_at，如有错过立即补偿触发
```

### Dashboard Tab

```
飞书配置 | 模型设置 | Skill 仓库 | 审批管理 | 审计日志 | SubAgent
```

---

## 未来规划

| 优先级 | 方向 | 说明 |
|--------|------|------|
| P1 | **钉钉接入** | 对称飞书方案 B，实现钉钉 Bot 交互式卡片 + 审批回调 |
| P3 | **用户角色体系** | admin / developer / readonly 等角色绑定 |
| P3 | **飞书命令式 Dashboard** | `/pending` `/approve` 等快捷命令在飞书内完成管理 |

---

## 原创设计

以下是 ColoBot 独立设计/实现的核心特性：

| 特性 | 说明 |
|------|------|
| **父子 Agent 协作** | 父Agent 创建子Agent 处理子任务，TTL 自动过期，工具白名单/黑名单隔离 |
| **Trigger next_fire_at 持久化** | 每次触发后计算并持久化下次触发时间，重启后自动补偿漏触 |
| **多层审批漏斗** | Tirith规则(精确) → Pattern历史(7天频率) → Smart LLM裁决，三层漏斗减少误拦 |
| **审批流双向推送** | 飞书卡片（交互式按钮）+ WebSocket（实时刷新）同时推送 |
| **跨 Provider Fallback 链** | `provider:modelId` 格式，支持 OpenAI ↔ Anthropic ↔ MiniMax 任意切换 |
| **DB 驱动热配置** | 飞书/SubAgent 等配置写入 `app_settings` 表，无需重启即可保存 |
| **LLM 驱动的子Agent 配置** | 父Agent 自行判断任务难度，生成子Agent 的 soul/工具/TTL，无硬编码策略 |
| **审批状态卡片更新** | 审批通过/拒绝后，用 `message_id` 更新原飞书卡片颜色，无需重新发消息 |
| **流式 LLM 继续审批** | `continueRun()` 使用流式 `agentChatStream()` 继续被阻塞的 LLM 对话 |
| **知识库** | concept/template/rule 三类知识，Agent 可直接 add/search/list，跨 Agent 共享 |
| **Context Compression** | 历史超过 context_window * 0.8 时触发，LLM 总结旧消息保留关键信息，保留最近 6 条 |

---

## 致谢 / 灵感来源

本项目设计参考了以下开源项目和文档：

| 来源 | 参考内容 |
|------|----------|
| [hermes-agent](https://github.com/org/hermes-agent) | Skill 自进化（提案→审批→上线）、多层审批流设计（规划中） |
| [Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook) | LLM 调用模式、流式处理、多模态 Content Block |
| [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) | Tool/Skill 抽象、工具注册机制 |
| [CrewAI](https://github.com/mistralai/crewai) | 多智能体协作、子 Agent 任务分解 |
| [AutoGen](https://microsoft.github.io/autogen/) | Agent 对话协作模式 |
| [Dify](https://github.com/langgenius/dify) | Trigger / Skill 编排、Markdown Skill 定义 |
| [飞书开放平台文档](https://open.feishu.cn/document/server-docs/bots/bots/bots-overview) | 飞书 Bot 交互式卡片、事件订阅、tenant_access_token 管理 |
| pgvector + PostgreSQL | 向量存储和混合检索方案 |
| [SearXNG](https://docs.searxng.org/) | 私有元搜索引擎集成 |

---

## License

Apache 2.0
