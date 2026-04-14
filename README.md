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

# 启动 PostgreSQL
docker compose up -d postgres

# 启动 ColoBot
npm run dev
```

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

## License

Apache 2.0
