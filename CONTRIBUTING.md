# 贡献指南

感谢关注 ColoBot！本指南帮助你顺利完成贡献。

## 开发环境

### 前置条件

- Node.js 22+
- PostgreSQL 18 + pgvector 扩展
- Docker（用于本地数据库）

### 快速启动

```bash
# 克隆
git clone https://github.com/leobinjones-art/ColoBot.git
cd colobot

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入必要的 KEY

# 启动数据库
docker compose up -d postgres

# 初始化数据库
npm run db:init

# 启动开发服务器
npm run dev
```

## 分支规范

| 前缀 | 用途 |
|------|------|
| `feat/` | 新功能 |
| `fix/` | Bug 修复 |
| `docs/` | 文档更新 |
| `refactor/` | 重构（无功能变化） |
| `test/` | 测试相关 |
| `chore/` | 构建/工具/依赖更新 |
| `security/` | 安全修复 |

示例：
```bash
git checkout -b feat/sop-export
git checkout -b fix/approval-timeout
git checkout -b docs/readme-update
```

## Commit Message 格式

采用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>: <short description>

[optional body]

[optional footer]
```

**Type**：

| Type | 描述 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档 |
| `style` | 格式（不影响代码含义） |
| `refactor` | 重构 |
| `test` | 测试 |
| `chore` | 构建/工具/依赖 |
| `security` | 安全 |

**Examples**：
```bash
feat: 添加审批规则自进化机制
fix: 修复 dashboard 登录页面白屏问题
docs: 更新 API 文档
security: 修复 SSRF 漏洞
```

## 代码风格

项目使用 Prettier 格式化代码，ESLint 做静态检查：

```bash
# 格式化所有文件
npx prettier --write .

# 检查格式（CI 中使用）
npx prettier --check .

# 运行 ESLint
npm run lint
```

**规则要点**：
- 无分号
- 单引号
- 100 字符宽度
- 箭头函数 always return

提交前务必运行 `npm test` 确保测试通过。

## PR 审核要求

- 至少 1 个 Approve 才能合并
- CI 必须全部通过（类型检查 + 测试 + 格式化检查）
- 新功能必须包含单元测试
- Bug 修复必须附上复现步骤

## 测试

```bash
# 运行所有测试
npm test

# 监听模式（开发时）
npm run test:watch

# 仅运行 E2E 测试
npm run test:e2e
```

## 核心模块说明

| 模块 | 文件 | 职责 |
|------|------|------|
| Agent 运行时 | `src/agent-runtime/runtime.ts` | 消息路由 + LLM 循环 |
| 审批引擎 | `src/agent-runtime/approval-rules.ts` | 四层漏斗 + 自进化 |
| 工具注册 | `src/agent-runtime/tools/executor.ts` | 工具定义 + 执行 |
| LLM 抽象 | `src/llm/index.ts` | 多 Provider Fallback |
| 记忆 | `src/memory/` | 向量 + 文本混合检索 |
| 飞书 | `src/services/feishu.ts` | 通知 + 卡片交互 |

## 安全

发现安全漏洞？请勿在 GitHub 公开 issue，优先通过邮件或其他私密渠道报告。

## License

贡献代码即表示你同意你的代码以 Apache 2.0 许可证发布。
