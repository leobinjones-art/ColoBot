# ColoBot

自带安全守护的 AI Agent 框架 — 多模态 AI × 安全母 Agent × 许可证系统

## 安装

```bash
npm install colobot
```

## 快速开始

```typescript
import { AgentRuntime, Sentinel, CharterManager } from 'colobot'

// 创建 Agent 运行时
const agent = new AgentRuntime({
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
})

// 启用安全守护
const sentinel = new Sentinel({
  enableInputScan: true,
  enableOutputScan: true,
})

// 申请许可证解锁能力
const charter = new CharterManager()
await charter.apply('academic', '论文写作')
```

## CLI 使用

```bash
# 安装后直接使用
npx colobot chat "你好"

# 或全局安装后
npm install -g colobot
colobot chat "帮我写一段代码"
```

## 包组成

| 包 | 说明 |
|---|---|
| @colobot/core | Agent 运行时核心 |
| @colobot/sentinel | 安全守护（输入输出扫描、进程守护） |
| @colobot/charter | 许可证系统（定义 AI 能力边界） |
| @colobot/types | 共享类型定义 |

## 许可证

AGPL-3.0