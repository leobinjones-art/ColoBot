# ColoBot

> 单智能体 + 子智能体协作平台 — 多模态 AI + Skill 编排 + SearXNG 搜索

---

## 核心功能

| 模块 | 功能 | 优先级 |
|------|------|--------|
| **智能体** | 父Agent（全模态：文本/图片/音频/视频） | P0 |
| | 子智能体（临时任务分解，TTL自动过期） | P0 |
| | 消息路由 / 会话管理 | P0 |
| **Trigger + Skill** | Trigger 引擎（cron/interval/webhook等） | P0 |
| | Skill 编排（Trigger → Skill 自动执行） | P0 |
| | Markdown Skill 定义 + 触发词激活 | P0 |
| | Skill 自进化（提案→审批→应用） | P0 |
| **AI自进化** | Soul 自进化（对话中学习新能力） | P0 |
| **搜索** | SearXNG 多模态搜索（文本/图片/视频/新闻） | P0 |
| **记忆** | 向量语义检索 + 文本混合检索 | P0 |
| **审批** | ApprovalFlow（L2/L3 分级 + 多渠道通知） | P0 |
| **审计** | 操作审计日志 | P0 |
| **渠道** | 飞书接入 | P1 |
| | Telegram/Discord/Slack | P2 |
| **认证** | API Key | P2 |

---

## 核心架构

```
用户消息 → 父Agent
              ↓
    ┌─────────┼─────────┐
    ↓         ↓         ↓
 子Agent   Skill     SearXNG  ← 搜索工具
    ↓         ↓
 Trigger   自进化
    ↓         ↓
 审批流   审计日志
```

### 智能体架构

- **父Agent**：主智能体，处理用户消息，全模态支持
- **子智能体**：临时创建，处理子任务，TTL 自动过期，工具白名单限制

### Skill 系统

- Markdown 格式定义
- 触发词激活 / Trigger 触发
- 自进化：从对话中学习，自动提案→审批→应用

### Trigger 编排

| 触发方式 | 说明 |
|----------|------|
| 触发词 | 消息内容匹配自动激活 |
| 定时（cron） | 定时执行 Skill |
| 间隔（interval） | 周期执行 Skill |
| Webhook | HTTP 回调触发 Skill |
| 条件 | 满足特定条件执行 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Node.js 22+ (TypeScript, ESM) |
| 数据库 | PostgreSQL + pgvector |
| LLM | OpenAI / Anthropic / MiniMax |
| 搜索 | SearXNG |
| 前端 | React 19 + Vite + TailwindCSS |
| 渠道 | 飞书 WebSocket / Telegram / Discord / Slack |
| 认证 | API Key |

---

## 服务端口

| 服务 | 地址 |
|------|------|
| ColoBot Runtime | `http://localhost:18792` |
| Dashboard | `http://localhost:5173` |
| PostgreSQL | `localhost:5432` |

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

> **注意**：ColoBot 使用 `pgvector` 做向量存储，必须使用带 pgvector 扩展的 PostgreSQL 镜像（如 `pgvector/pgvector:pg18`）。官方 `postgres` 镜像不包含 pgvector，会导致 `agent_memory` 表创建失败。

---

## 项目结构

```
colobot/
├── src/
│   ├── colobot-server.ts     # HTTP + WebSocket 入口
│   ├── agent-runtime/        # 智能体运行时
│   │   ├── runtime.ts        # 消息路由 + LLM 循环
│   │   ├── sub-agents.ts     # 子智能体管理
│   │   ├── skill-evolution.ts # Skill 自进化
│   │   ├── approval.ts        # 审批流
│   │   └── tools/            # 工具注册
│   ├── agents/               # Agent 管理
│   ├── channels/             # 渠道适配器
│   ├── llm/                  # LLM 抽象层
│   ├── memory/               # 向量 + 文本检索
│   ├── auth/                 # 认证
│   ├── services/             # 审计/通知/心跳
│   └── middleware/           # 中间件
├── dashboard/                # React 前端
└── sql/
    └── schema.sql            # 数据库 schema
```

---

## API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/agents` | GET/POST | 列出/创建 Agent |
| `/api/agents/:id` | GET/DELETE | 获取/删除单个 Agent |
| `/api/chat` | POST | 发送消息（自动路由到 Skill 或 Agent） |
| `/api/memory/search` | POST | 记忆语义搜索 |
| `/api/search` | POST | SearXNG 搜索 |
| `/api/skills` | GET/POST | 列出/创建 Skill |
| `/api/triggers/fire` | POST | 触发 Webhook Trigger |
| `/api/approvals` | GET | 获取待审批请求 |
| `/api/approvals/:id/approve` | POST | 审批通过 |
| `/api/approvals/:id/reject` | POST | 审批拒绝 |
| `/health` | GET | 健康检查 |

---

## 项目状态

### 模块完成度

| 模块 | 完成度 | 状态 |
|------|--------|------|
| 父Agent 运行时 | 90% | ✅ 审计 + 审批触发 |
| 子Agent | 60% | 纯内存设计，多模态工具支持 |
| Skill 系统 | 50% | 可用，缺 Schema 验证 |
| Trigger 引擎 | 50% | interval/cron/webhook 可用，缺 condition |
| 向量记忆 | 70% | ✅ embedding 存储 + 混合搜索 |
| 审批流 | 50% | ✅ 触发已集成，执行待优化 |
| Soul 自进化 | 70% | ✅ 表已创建，流程可用 |
| 全模态支持 | ✅ | OpenAI/Anthropic/MiniMax 全模态 |
| 审计日志 | ✅ | services/audit.ts 全链路写入 |
| 渠道接入 | 10% | 仅 WebSocket，飞书/TG 等未接入 |
| 前端 Dashboard | 0% | 待开发 |
| 认证 | ✅ | API Key 中间件 |

### 已完成 (P0)

| # | 功能 | 文件 |
|---|------|------|
| 1 | `soul_proposals` 表 | sql/schema.sql |
| 2 | `addMemory()` embedding | src/memory/vector.ts |
| 3 | 全模态支持 | src/llm/index.ts |
| 4 | 审计日志写入 | src/services/audit.ts |
| 5 | 审批流触发 | src/agent-runtime/runtime.ts |
| 6 | API Key 认证 | src/middleware/auth.ts |

### 剩余问题

#### 待完成

| # | 模块 | 说明 | 优先级 |
|---|------|------|--------|
| 1 | 子Agent | 纯内存设计，重启丢失；多模态工具支持 | P0 |
| 2 | Skill 系统 | 缺 Schema 验证 | P0 |
| 3 | Trigger 引擎 | 缺 condition 条件触发 | P0 |
| 4 | 审批流 | 执行流程待优化 | P1 |
| 5 | 渠道接入 | 飞书/Telegram/Discord/Slack | P1 |
| 6 | 前端 Dashboard | Web UI | 待定 |

#### Bug / 改进

| # | 问题 | 位置 |
|---|------|------|
| 1 | `parseBody` JSON 失败返回 500 | `colobot-server.ts`（应返回 400）|
| 2 | Trigger timers 内存中，重启丢失 | `trigger-runtime.ts` |
| 3 | Cron 只支持分钟/小时 | `trigger-runtime.ts` |

---

## License

Apache 2.0
