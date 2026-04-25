# @colobot/types

ColoBot 共享类型定义包。

## 安装

```bash
npm install @colobot/types
```

## 使用

```typescript
import type { LLMMessage, SubAgentConfig, SopStep } from '@colobot/types';

const message: LLMMessage = {
  role: 'user',
  content: 'Hello'
};
```

## 类型模块

| 模块 | 说明 |
|------|------|
| `llm` | LLM 消息、选项、工具定义 |
| `agent` | 子代理、技能、审批 |
| `memory` | 嵌入、记忆、知识库 |
| `channel` | 通道消息、适配器接口 |
| `sop` | SOP 步骤、状态、任务分析 |
| `service` | 用户、通知、审计、设置 |
| `tool` | 工具调用、结果、上下文 |

## 构建

```bash
npm run build
```

## License

Apache-2.0
