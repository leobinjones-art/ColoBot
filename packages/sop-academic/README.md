# @colobot/sop-academic

ColoBot SOP 学术研究流程包。

## 功能

- **AI 动态任务拆解** - 根据用户输入自动生成研究步骤
- **子 Agent 协作** - 每个步骤创建专用子 Agent 处理
- **步骤审核** - AI 自动审核步骤结果
- **最终报告生成** - 汇总所有步骤生成研究报告
- **流程控制** - 暂停/恢复/取消/重启

## 安装

```bash
npm install @colobot/sop-academic @colobot/core
```

## 使用

```typescript
import { createSopEngine, isAcademicIntent, detectSopCommand } from '@colobot/sop-academic';
import { ColoBotRuntimeImpl, type RuntimeDependencies } from '@colobot/core';

// 创建运行时
const deps: RuntimeDependencies = {
  llm: new OpenAIProvider({ apiKey: 'sk-xxx' }),
  stateStore: new InMemoryStateStore(),
  memoryStore: new InMemoryStore(),
  fileSystem: new LocalFileSystemAdapter(),
  // ... 其他依赖
};
const runtime = new ColoBotRuntimeImpl(deps);

// 创建 SOP 引擎
const sop = createSopEngine(runtime);

// 检测学术意图
if (isAcademicIntent(userMessage)) {
  // 分析任务
  const analysis = await sop.analyzeTask(userMessage);
  
  if (analysis.isAcademicTask) {
    // 创建流程
    const state = await sop.createTask(agentId, sessionKey, analysis, userMessage);
    
    // 显示任务拆解
    console.log(formatTaskBreakdown(state));
  }
}

// 处理流程控制
const command = detectSopCommand(message);
switch (command.type) {
  case 'confirm':
    await sop.confirmBreakdown(state);
    break;
  case 'pause':
    await sop.pauseTask(state);
    break;
  case 'resume':
    await sop.resumeTask(state);
    break;
  case 'exit':
    await sop.cancelTask(state);
    break;
}

// 提交步骤数据
await sop.submitStepData(state, userData);

// 审核步骤
const review = await sop.reviewStep(state);
if (review.approved) {
  await sop.advanceStep(state);
}

// 生成最终报告
if (state.status === 'completed') {
  const report = await sop.generateFinalOutput(state);
}
```

## API

### SopEngine

| 方法 | 说明 |
|------|------|
| `analyzeTask(message)` | AI 分析任务 |
| `createTask(agentId, sessionKey, analysis, message)` | 创建流程 |
| `confirmBreakdown(state)` | 确认任务拆解 |
| `submitStepData(state, userData)` | 提交步骤数据 |
| `reviewStep(state)` | 审核步骤 |
| `advanceStep(state)` | 推进到下一步 |
| `pauseTask(state)` | 暂停流程 |
| `resumeTask(state)` | 恢复流程 |
| `cancelTask(state)` | 取消流程 |
| `generateFinalOutput(state)` | 生成最终报告 |
| `generateGuidance(state)` | 生成步骤引导 |

### 工具函数

| 函数 | 说明 |
|------|------|
| `isAcademicIntent(message)` | 检测学术研究意图 |
| `detectSopCommand(message)` | 检测流程控制指令 |
| `formatTaskBreakdown(state)` | 格式化任务拆解 |
| `formatSopStatus(state)` | 格式化流程状态 |

## 类型

```typescript
interface SopState {
  taskId: string;
  agentId: string;
  taskName: string;
  taskSummary: string;
  steps: SopStep[];
  currentStep: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  researchPurpose?: 'paper' | 'research' | 'learning';
}

interface SopStep {
  step: number;
  name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked';
  userData: string | null;
  subAgentResult: string | null;
  approved: boolean;
}

interface TaskAnalysis {
  isAcademicTask: boolean;
  taskName: string;
  suggestedSteps: Array<{ name: string; description?: string }>;
  researchPurpose?: 'paper' | 'research' | 'learning';
}
```

## 依赖

- `@colobot/core` - 核心运行时
- `@colobot/types` - 类型定义

## License

Apache-2.0
