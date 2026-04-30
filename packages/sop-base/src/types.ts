/**
 * SOP 流程引擎基类类型定义
 */

// ─── 步骤状态 ──────────────────────────────────────────────

export type SopStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'

// ─── 步骤定义 ──────────────────────────────────────────────

export interface SopStep {
  /** 步骤 ID */
  id: string
  /** 步骤名称 */
  name: string
  /** 步骤描述 */
  description: string
  /** 步骤状态 */
  status: SopStepStatus
  /** 依赖的步骤 ID */
  dependencies?: string[]
  /** 步骤数据 */
  data?: Record<string, unknown>
  /** 错误信息 */
  error?: string
  /** 开始时间 */
  startedAt?: number
  /** 完成时间 */
  completedAt?: number
}

// ─── 任务状态 ──────────────────────────────────────────────

export type SopTaskStatus = 'created' | 'analyzing' | 'ready' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

// ─── 任务定义 ──────────────────────────────────────────────

export interface SopTask {
  /** 任务 ID */
  id: string
  /** 任务类型 */
  type: string
  /** 任务描述 */
  description: string
  /** 任务状态 */
  status: SopTaskStatus
  /** 步骤列表 */
  steps: SopStep[]
  /** 当前步骤索引 */
  currentStepIndex: number
  /** 任务上下文 */
  context: Record<string, unknown>
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
  /** 完成时间 */
  completedAt?: number
  /** 最终输出 */
  output?: string
}

// ─── 任务分析结果 ──────────────────────────────────────────────

export interface TaskAnalysis {
  /** 任务类型 */
  type: string
  /** 任务描述 */
  description: string
  /** 建议步骤 */
  steps: Omit<SopStep, 'id' | 'status'>[]
  /** 所需工具 */
  requiredTools?: string[]
  /** 预估时间（分钟） */
  estimatedTime?: number
  /** 复杂度评分 1-10 */
  complexity?: number
}

// ─── 引擎配置 ──────────────────────────────────────────────

export interface SopEngineConfig {
  /** 引擎名称 */
  name: string
  /** 引擎版本 */
  version: string
  /** 最大步骤数 */
  maxSteps?: number
  /** 步骤超时（毫秒） */
  stepTimeout?: number
  /** 是否自动推进 */
  autoAdvance?: boolean
}

// ─── 引擎事件 ──────────────────────────────────────────────

export interface SopEngineEvents {
  onTaskCreated?: (task: SopTask) => void | Promise<void>
  onTaskCompleted?: (task: SopTask) => void | Promise<void>
  onTaskFailed?: (task: SopTask, error: Error) => void | Promise<void>
  onStepStarted?: (task: SopTask, step: SopStep) => void | Promise<void>
  onStepCompleted?: (task: SopTask, step: SopStep) => void | Promise<void>
  onStepFailed?: (task: SopTask, step: SopStep, error: Error) => void | Promise<void>
}

// ─── 引擎接口 ──────────────────────────────────────────────

export interface ISopEngine {
  /** 引擎名称 */
  readonly name: string
  /** 引擎版本 */
  readonly version: string

  /** 分析任务 */
  analyzeTask(userMessage: string, context?: Record<string, unknown>): Promise<TaskAnalysis>

  /** 创建任务 */
  createTask(userMessage: string, context?: Record<string, unknown>): Promise<SopTask>

  /** 获取任务 */
  getTask(taskId: string): Promise<SopTask | null>

  /** 列出任务 */
  listTasks(status?: SopTaskStatus): Promise<SopTask[]>

  /** 启动任务 */
  startTask(taskId: string): Promise<void>

  /** 暂停任务 */
  pauseTask(taskId: string): Promise<void>

  /** 恢复任务 */
  resumeTask(taskId: string): Promise<void>

  /** 取消任务 */
  cancelTask(taskId: string): Promise<void>

  /** 提交步骤数据 */
  submitStepData(taskId: string, stepId: string, data: Record<string, unknown>): Promise<void>

  /** 获取当前步骤 */
  getCurrentStep(taskId: string): Promise<SopStep | null>

  /** 推进到下一步 */
  advanceStep(taskId: string): Promise<void>

  /** 生成最终输出 */
  generateOutput(taskId: string): Promise<string>
}

// ─── 步骤执行器 ──────────────────────────────────────────────

export type StepExecutor = (step: SopStep, task: SopTask, context: Record<string, unknown>) => Promise<Record<string, unknown> | void>

// ─── 步骤注册表 ──────────────────────────────────────────────

export interface StepRegistry {
  register(stepType: string, executor: StepExecutor): void
  get(stepType: string): StepExecutor | undefined
  list(): string[]
}
