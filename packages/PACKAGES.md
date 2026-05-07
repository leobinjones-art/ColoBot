# NexusMind 包说明

## 核心包架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         应用层                                   │
│  frontend (Vue 3)  │  tui (终端UI)  │  server (API服务)         │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         安全层                                   │
│  sentinel - 独立安全守护，平行链路，不参与业务逻辑               │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         许可层                                   │
│  charter - 许可证系统，定义AI能力边界，绑定文档库防幻觉          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         运行时层                                 │
│  core - Agent运行时、LLM调用、工具执行、子Agent管理              │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         基础层                                   │
│  types - 共享类型定义，零依赖                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## @nexusmind/types

**共享类型定义包**

零依赖的纯类型包，定义整个系统使用的接口和类型。

### 导出类型

| 分类    | 类型                                           | 说明                    |
| ------- | ---------------------------------------------- | ----------------------- |
| LLM     | `LLMMessage`, `ContentBlock`, `ToolDefinition` | LLM 消息格式、工具定义  |
| Agent   | `SubAgentType`, `Skill`, `ApprovalRequest`     | 子Agent类型、技能、审批 |
| Memory  | `MemoryResult`, `KnowledgeEntry`               | 记忆存储、知识库条目    |
| Channel | `ChannelMessage`, `ChannelAdapter`             | 通道消息、适配器接口    |
| SOP     | `SopStep`, `SopState`                          | SOP步骤、状态（已弃用） |
| Tool    | `ToolCall`, `ToolResult`, `ToolContext`        | 工具调用、结果、上下文  |

### 设计原则

- **零运行时依赖** - 只包含 TypeScript 类型定义
- **稳定接口** - 其他包依赖此包的类型
- **文档即代码** - 类型定义即是最准确的文档

---

## @nexusmind/core

**Agent 运行时核心**

提供 Agent 运行所需的所有基础设施：LLM 调用、工具执行、记忆存储、子 Agent 管理。

### 核心能力

| 模块      | 功能         | 关键导出                                                 |
| --------- | ------------ | -------------------------------------------------------- |
| Runtime   | Agent 运行时 | `AgentRuntime`, `RunOptions`, `RunResult`                |
| Providers | LLM 提供者   | `OpenAIProvider`, `AnthropicProvider`, `MiniMaxProvider` |
| Tools     | 工具系统     | `ToolRegistry`, `registerBuiltinTools`                   |
| SubAgents | 子智能体     | `spawnSubAgent`, `runSubAgentTask`                       |
| Chunking  | 大文件分块   | `readChunksByBytes`, `readChunksByTokens`                |
| Memory    | 记忆存储     | `InMemoryStore`, `SQLiteStore`                           |
| Skills    | 技能系统     | `executeSkill`, `evolveSkillFromConversation`            |
| Vision    | 视觉分析     | `analyzeImage`, `analyzeImageLocal`                      |

### 子 Agent 架构

**核心目的：突破 LLM 会话上下文限制**

当处理大文件（如 100MB 日志）时，单个 LLM 会话无法容纳全部内容。子 Agent 架构允许：

1. **分区处理** - 将大文件分成多个区块
2. **并行处理** - 多个子 Agent 同时处理不同区块
3. **结果合并** - 主 Agent 合并所有子 Agent 结果

```typescript
// 示例：大文件分区处理
const chunks = readChunksByTokens(largeFile, { maxTokens: 10000 })
const results = await Promise.all(
  chunks.map((chunk) => runSubAgentTask({ task: 'analyze', input: chunk })),
)
const merged = mergeResults(results)
```

### 设计原则

- **插件化** - 所有组件通过接口定义，可替换实现
- **高层 API** - 导出简洁的函数接口，隐藏实现细节
- **无状态优先** - 核心逻辑无状态，状态由外部管理

---

## @nexusmind/sentinel

**安全守护母 Agent**

独立的安全守护系统，与业务逻辑完全分离。采用平行链路架构，不参与业务决策。

### 核心职责

| 模块           | 功能            | 响应时间 |
| -------------- | --------------- | -------- |
| RuleEngine     | 敏感词/正则扫描 | < 1ms    |
| Heartbeat      | Agent 心跳监控  | 2s 间隔  |
| TimeoutMonitor | 会话超时监控    | 可配置   |
| Takeover       | 异常接管        | 即时     |
| CharterGuard   | 许可证权限检查  | < 1ms    |

### 安全架构

```
用户输入 ──┬──▶ RuleEngine 扫描 ──┬──▶ 通过 ──▶ 业务处理
           │                      │
           │                      └──▶ 拦截 ──▶ 返回兜底话术
           │
           └──▶ CharterGuard 许可证检查
                    │
                    ├──▶ 有许可证 ──▶ 放行
                    └──▶ 无许可证 ──▶ 拒绝 + 提示申请
```

### 关键特性

1. **独立链路** - Sentinel 不依赖业务逻辑，业务崩溃不影响安全
2. **兜底话术** - 所有异常情况都有预定义的友好回复
3. **心跳监控** - 检测 Agent 失联，自动触发接管
4. **自身守护** - Sentinel 自身也有心跳，防止守护进程死亡

### CharterGuard 集成

```typescript
import { CharterGuard } from '@nexusmind/sentinel'

const guard = new CharterGuard()

// 检查能力权限
const result = guard.checkCapability(userId, 'paper-writing')
if (!result.allowed) {
  return guard.generateCharterRequestPrompt(userId, 'paper-writing')
}

// 获取相关文档库条目（防止幻觉）
const entries = result.libraryEntries
// entries 包含该能力相关的规范文档
```

---

## @nexusmind/charter

**许可证系统**

定义 AI 可以做什么，通过许可证解锁特定能力，绑定文档库提供可追溯的事实来源。

### 核心概念

| 概念             | 说明                                           |
| ---------------- | ---------------------------------------------- |
| Charter 许可证   | 定义一组能力和约束                             |
| Document Library | 提供可追溯的事实来源                           |
| Capability       | 具体能力，如 `paper-writing`、`contract-draft` |
| Instance         | 用户申请后的许可证实例                         |

### 内置许可证

| 许可证   | 能力                           | 文档库     | 有效期 |
| -------- | ------------------------------ | ---------- | ------ |
| academic | 论文写作、文献综述、引用格式   | 学术规范库 | 24小时 |
| legal    | 合同起草、免责声明、法律分析   | 法律模板库 | 12小时 |
| longdoc  | 长文档写作、分区处理、目录生成 | 通用写作库 | 6小时  |

### 文档库内容

**学术规范库 (academic)**

- APA/MLA/IEEE 引用格式
- 学术伦理准则
- 论文结构模板

**法律模板库 (legal)**

- 免责声明模板
- 隐私声明模板
- NDA 模板
- 标准合同条款

**通用写作库 (general)**

- 文档结构指南
- 写作风格规范
- 目录模板

### 使用示例

```typescript
import { charterManager } from '@nexusmind/charter'

// 1. 用户申请许可证
const instance = charterManager.requestCharter(userId, {
  type: 'academic',
  reason: '撰写毕业论文',
  sessionId: 'session-123',
})

// 2. 管理员审批（如果需要）
charterManager.activateCharter(instance.id, 'admin-id')

// 3. 检查权限
const result = charterManager.checkCapability(userId, 'paper-writing')
if (result.allowed) {
  // 获取相关文档库条目
  const library = charterManager.getCharterLibrary(result.charter.charterId)
  // library.entries 包含引用格式等规范
}

// 4. 许可证自动过期
// 到期后 checkCapability 返回 allowed: false
```

### 设计哲学

1. **默认最大限制** - 无许可证时，AI 能力受限
2. **许可证解锁** - 申请并获批后，解锁特定能力
3. **文档库防幻觉** - 能力执行时引用文档库条目，确保有据可查
4. **可追溯** - 每个许可证实例记录申请原因、审批人、时间

---

## 架构设计原则

### 为什么需要 Charter？

**问题**：SOP（标准操作流程）是预设的工作流编排，但 AI 本身已经具备动态编排能力，SOP 变得冗余。

**解决**：Charter 许可证系统

- 不预设工作流，AI 自主决策
- 通过许可证定义能力边界
- 通过文档库提供事实依据

### 为什么需要 Sentinel？

**问题**：业务 Agent 可能崩溃、超时、被攻击，需要独立的安全守护。

**解决**：平行链路架构

- Sentinel 与业务 Agent 完全独立
- 业务崩溃不影响安全守护
- 自身心跳确保 Sentinel 本身存活

### 为什么需要子 Agent？

**问题**：LLM 会话有上下文限制（如 128K tokens），无法处理大文件。

**解决**：分区处理

- 主 Agent 协调，子 Agent 处理分区
- 合并结果返回
- 突破单会话限制

---

## 包依赖关系

```
types ← core ← charter ← sentinel
        ↑         ↑         ↑
        └─────────┴─────────┴── frontend/tui/server
```

- `types` - 基础，无依赖
- `core` - 依赖 types
- `charter` - 依赖 types
- `sentinel` - 依赖 types + charter
- 应用层 - 可依赖任意包
