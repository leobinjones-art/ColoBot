/**
 * SOP 流程引擎基类
 */

import type {
  SopTask,
  SopStep,
  SopTaskStatus,
  TaskAnalysis,
  SopEngineConfig,
  SopEngineEvents,
  StepExecutor,
  ISopEngine,
} from './types.js'

// ─── 工具函数 ──────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── SOP 引擎基类 ──────────────────────────────────────────────

export abstract class SopEngine implements ISopEngine {
  readonly name: string
  readonly version: string

  protected config: SopEngineConfig
  protected events: SopEngineEvents
  protected tasks: Map<string, SopTask> = new Map()
  protected stepExecutors: Map<string, StepExecutor> = new Map()

  constructor(config: SopEngineConfig, events?: SopEngineEvents) {
    this.name = config.name
    this.version = config.version
    this.config = {
      maxSteps: 20,
      stepTimeout: 300000, // 5 minutes
      autoAdvance: false,
      ...config,
    }
    this.events = events || {}
  }

  // ─── 抽象方法（子类实现）──────────────────────────────────────────────

  abstract analyzeTask(userMessage: string, context?: Record<string, unknown>): Promise<TaskAnalysis>

  // ─── 任务管理 ──────────────────────────────────────────────

  async createTask(userMessage: string, context?: Record<string, unknown>): Promise<SopTask> {
    const analysis = await this.analyzeTask(userMessage, context)

    // 验证步骤数
    if (analysis.steps.length > (this.config.maxSteps || 20)) {
      throw new Error(`Too many steps: ${analysis.steps.length} > ${this.config.maxSteps}`)
    }

    const task: SopTask = {
      id: generateId(),
      type: analysis.type,
      description: analysis.description,
      status: 'created',
      steps: analysis.steps.map((step, index) => ({
        ...step,
        id: `step-${index + 1}`,
        status: 'pending' as const,
      })),
      currentStepIndex: 0,
      context: {
        userMessage,
        ...context,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.tasks.set(task.id, task)
    await this.events.onTaskCreated?.(task)

    return task
  }

  async getTask(taskId: string): Promise<SopTask | null> {
    return this.tasks.get(taskId) || null
  }

  async listTasks(status?: SopTaskStatus): Promise<SopTask[]> {
    const tasks = Array.from(this.tasks.values())
    if (status) {
      return tasks.filter((t) => t.status === status)
    }
    return tasks
  }

  // ─── 任务控制 ──────────────────────────────────────────────

  async startTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    if (task.status !== 'created' && task.status !== 'paused') {
      throw new Error(`Cannot start task in status: ${task.status}`)
    }

    task.status = 'running'
    task.updatedAt = Date.now()

    // 开始第一个步骤
    if (task.steps.length > 0) {
      await this.startStep(task, task.steps[0])
    }
  }

  async pauseTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    if (task.status !== 'running') {
      throw new Error(`Cannot pause task in status: ${task.status}`)
    }

    task.status = 'paused'
    task.updatedAt = Date.now()
  }

  async resumeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    if (task.status !== 'paused') {
      throw new Error(`Cannot resume task in status: ${task.status}`)
    }

    task.status = 'running'
    task.updatedAt = Date.now()
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    task.status = 'cancelled'
    task.updatedAt = Date.now()
  }

  // ─── 步骤管理 ──────────────────────────────────────────────

  async submitStepData(taskId: string, stepId: string, data: Record<string, unknown>): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    const step = task.steps.find((s) => s.id === stepId)
    if (!step) throw new Error(`Step not found: ${stepId}`)

    step.data = { ...step.data, ...data }
    task.updatedAt = Date.now()
  }

  async getCurrentStep(taskId: string): Promise<SopStep | null> {
    const task = this.tasks.get(taskId)
    if (!task) return null

    if (task.currentStepIndex >= task.steps.length) {
      return null
    }

    return task.steps[task.currentStepIndex]
  }

  async advanceStep(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    const currentStep = task.steps[task.currentStepIndex]
    if (currentStep && currentStep.status !== 'completed') {
      throw new Error(`Current step not completed: ${currentStep.id}`)
    }

    task.currentStepIndex++
    task.updatedAt = Date.now()

    // 检查是否完成
    if (task.currentStepIndex >= task.steps.length) {
      task.status = 'completed'
      task.completedAt = Date.now()
      task.output = await this.generateOutput(taskId)
      await this.events.onTaskCompleted?.(task)
    } else {
      // 开始下一个步骤
      const nextStep = task.steps[task.currentStepIndex]
      await this.startStep(task, nextStep)
    }
  }

  // ─── 输出生成 ──────────────────────────────────────────────

  async generateOutput(taskId: string): Promise<string> {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    // 基础实现：汇总所有步骤数据
    const outputs: string[] = []
    for (const step of task.steps) {
      if (step.status === 'completed' && step.data) {
        outputs.push(`## ${step.name}\n${JSON.stringify(step.data, null, 2)}`)
      }
    }

    return outputs.join('\n\n')
  }

  // ─── 步骤执行器注册 ──────────────────────────────────────────────

  registerStepExecutor(stepType: string, executor: StepExecutor): void {
    this.stepExecutors.set(stepType, executor)
  }

  // ─── 内部方法 ──────────────────────────────────────────────

  protected async startStep(task: SopTask, step: SopStep): Promise<void> {
    // 检查依赖
    if (step.dependencies) {
      for (const depId of step.dependencies) {
        const depStep = task.steps.find((s) => s.id === depId)
        if (depStep && depStep.status !== 'completed') {
          throw new Error(`Dependency not completed: ${depId}`)
        }
      }
    }

    step.status = 'in_progress'
    step.startedAt = Date.now()
    task.updatedAt = Date.now()

    await this.events.onStepStarted?.(task, step)

    // 执行步骤
    try {
      const executor = this.stepExecutors.get(step.name)
      if (executor) {
        const result = await executor(step, task, task.context)
        if (result) {
          step.data = { ...step.data, ...result }
        }
      }

      step.status = 'completed'
      step.completedAt = Date.now()
      await this.events.onStepCompleted?.(task, step)

      // 自动推进
      if (this.config.autoAdvance) {
        await this.advanceStep(task.id)
      }
    } catch (error) {
      step.status = 'failed'
      step.error = error instanceof Error ? error.message : String(error)
      await this.events.onStepFailed?.(task, step, error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }
}
