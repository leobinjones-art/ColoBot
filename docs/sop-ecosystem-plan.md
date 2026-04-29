# SOP 开源生态规划

## 背景

SOP (Standard Operating Procedure) 模块是 ColoBot 的可插拔流程扩展。通过开源 SOP 接口，让社区能够自行贡献特定领域的流程模块，形成丰富的场景生态。

---

## 架构设计

### 1. 包结构

```
@colobot/sop-base          # 基础接口 + 注册器（官方维护）
@colobot/sop-academic      # 学术研究流程（官方示例）
@colobot/sop-writing       # 写作助手流程（官方示例）

colobot-sop-*              # 社区贡献包（npm 发布）
```

### 2. 核心接口

```typescript
// @colobot/sop-base
interface SopModule {
  // 元信息
  name: string // 唯一标识，如 'academic'
  version: string
  description: string
  author?: string
  tags?: string[] // 如 ['research', 'paper', 'thesis']

  // 意图检测
  detectIntent(message: string, context?: SopContext): boolean | Promise<boolean>

  // 任务分析
  analyzeTask(message: string, runtime: ColoBotRuntime): Promise<TaskAnalysis>

  // 步骤模板（可选）
  stepTemplates?: SopStepTemplate[]

  // 配置 Schema
  configSchema?: object

  // 生命周期钩子
  hooks?: {
    beforeStart?: (state: SopState) => Promise<void>
    afterStep?: (state: SopState, step: SopStep) => Promise<void>
    onComplete?: (state: SopState) => Promise<string>
    onError?: (state: SopState, error: Error) => Promise<void>
  }
}

interface TaskAnalysis {
  isMatched: boolean
  taskType: string
  taskName: string
  suggestedSteps: Array<{
    name: string
    description?: string
    tools?: string[] // 该步骤可用工具
    estimatedTime?: string
  }>
  metadata?: Record<string, unknown>
}

interface SopStepTemplate {
  name: string
  description?: string
  tools?: string[]
  autoApprove?: boolean // 是否自动通过审核
  guidance?: string // 引导提示模板
}
```

### 3. 注册器

```typescript
// sopRegistry - 全局 SOP 注册器
class SopRegistry {
  // 注册模块
  register(module: SopModule): void

  // 批量注册
  registerAll(modules: SopModule[]): void

  // 匹配意图
  match(message: string, context?: SopContext): SopModule | null

  // 获取模块
  get(name: string): SopModule | undefined

  // 列出所有
  list(): SopModule[]

  // 按标签筛选
  findByTag(tag: string): SopModule[]
}
```

---

## 官方 SOP 模块

### @colobot/sop-academic（已有）

学术研究流程，适用于论文写作、文献调研、实验设计等场景。

**步骤：**

1. 明确研究问题
2. 文献检索与综述
3. 研究方法设计
4. 数据收集与分析
5. 结果整理与讨论
6. 论文撰写与润色

### @colobot/sop-writing（规划）

写作助手流程，适用于长文写作、报告生成等场景。

**步骤：**

1. 确定主题与大纲
2. 资料收集
3. 分段撰写
4. 整合与润色
5. 格式调整

### @colobot/sop-coding（规划）

编程项目流程，适用于从零开始的项目开发。

**步骤：**

1. 需求分析
2. 技术选型
3. 架构设计
4. 模块实现
5. 测试与调试
6. 文档编写

---

## 社区贡献指南

### 命名规范

- npm 包名：`colobot-sop-{domain}`
- 示例：`colobot-sop-legal`、`colobot-sop-medical`

### 目录结构

```
colobot-sop-legal/
├── package.json
├── src/
│   ├── index.ts          # 导出 SopModule
│   ├── prompts.ts        # Prompt 模板
│   └── templates.ts      # 步骤模板
├── README.md
└── examples/
```

### package.json 示例

```json
{
  "name": "colobot-sop-legal",
  "version": "1.0.0",
  "description": "法律文书撰写 SOP 模块",
  "main": "dist/index.js",
  "keywords": ["colobot", "sop", "legal"],
  "peerDependencies": {
    "@colobot/sop-base": "^1.0.0",
    "@colobot/core": "^0.2.0"
  }
}
```

### 实现示例

```typescript
// src/index.ts
import type { SopModule } from '@colobot/sop-base'

export const legalSop: SopModule = {
  name: 'legal',
  version: '1.0.0',
  description: '法律文书撰写流程',
  tags: ['legal', 'contract', 'document'],

  detectIntent(message) {
    return /合同|协议|法律|条款|诉讼/i.test(message)
  },

  async analyzeTask(message, runtime) {
    // 调用 LLM 分析任务
    const response = await runtime.chat(`分析法律文书任务：${message}`)
    // 返回 TaskAnalysis
  },

  stepTemplates: [
    { name: '需求确认', description: '明确文书类型和关键条款' },
    { name: '模板检索', description: '查找相关法律文书模板' },
    { name: '条款起草', description: '逐条撰写核心条款' },
    { name: '合规审核', description: '检查法律合规性' },
    { name: '格式整理', description: '调整文书格式' },
  ],
}
```

---

## 生态路线图

### Phase 1: 基础设施（v0.3）

- [ ] 创建 `@colobot/sop-base` 包
- [ ] 定义 `SopModule` 接口
- [ ] 实现 `SopRegistry` 注册器
- [ ] 重构 `@colobot/sop-academic` 符合接口
- [ ] 编写贡献指南文档

### Phase 2: 官方扩展（v0.4）

- [ ] 实现 `@colobot/sop-writing`
- [ ] 实现 `@colobot/sop-coding`
- [ ] 添加 SOP 配置 UI

### Phase 3: 社区生态（v0.5+）

- [ ] 发布 SOP 开发模板仓库
- [ ] 创建 SOP 贡献榜单
- [ ] 支持 SOP 插件市场

---

## 预期社区 SOP

| 领域 | 包名                      | 场景                 |
| ---- | ------------------------- | -------------------- |
| 法律 | `colobot-sop-legal`       | 合同、协议、诉讼文书 |
| 医疗 | `colobot-sop-medical`     | 问诊记录、病历整理   |
| 商业 | `colobot-sop-business`    | 商业计划、市场分析   |
| 教育 | `colobot-sop-education`   | 课程设计、教案编写   |
| 翻译 | `colobot-sop-translation` | 多语言文档翻译       |
| 数据 | `colobot-sop-data`        | 数据清洗、分析报告   |
| 运维 | `colobot-sop-ops`         | 故障排查、部署流程   |

---

## 技术细节

### 优先级匹配

当多个 SOP 匹配同一消息时，按优先级选择：

```typescript
// 用户消息可能同时匹配多个 SOP
const matches = sopRegistry.list().filter((m) => m.detectIntent(message))

// 按匹配度排序
const best = matches.sort((a, b) => {
  // 1. 专用 SOP 优先于通用 SOP
  // 2. 用户历史偏好
  // 3. 配置优先级
})[0]
```

### 配置持久化

```typescript
// SOP 配置存储在 ~/.colobot/sop-config.json
{
  "enabled": ["academic", "writing", "legal"],
  "disabled": [],
  "priority": {
    "academic": 10,
    "writing": 5
  },
  "moduleConfig": {
    "academic": {
      "languages": ["zh", "en"],
      "maxSteps": 10
    }
  }
}
```

### 热加载

```typescript
// 支持运行时加载新 SOP
import { sopRegistry } from '@colobot/sop-base'

// 从 npm 包加载
await sopRegistry.loadFromNpm('colobot-sop-legal')

// 从本地路径加载
await sopRegistry.loadFromPath('./my-sop')
```

---

## 许可证

- `@colobot/sop-base`: AGPL-3.0（与 core 一致）
- 官方 SOP 模块: AGPL-3.0
- 社区 SOP 模块: 自行选择（推荐 MIT 或 AGPL-3.0）
