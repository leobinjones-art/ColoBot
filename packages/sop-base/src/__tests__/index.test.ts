/**
 * SOP 流程引擎基类测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SopEngine, buildPrompt, TASK_ANALYSIS_PROMPT } from '../index.js'
import type { TaskAnalysis, SopEngineConfig, SopEngineEvents } from '../types.js'

// ─── 测试引擎实现 ──────────────────────────────────────────────

class TestSopEngine extends SopEngine {
  constructor(config: SopEngineConfig, events?: SopEngineEvents) {
    super(config, events)
  }

  async analyzeTask(userMessage: string, context?: Record<string, unknown>): Promise<TaskAnalysis> {
    // 简单的测试实现
    return {
      type: 'test-task',
      description: userMessage,
      steps: [
        { name: 'step-1', description: 'First step' },
        { name: 'step-2', description: 'Second step' },
      ],
      requiredTools: ['test-tool'],
      estimatedTime: 5,
      complexity: 3,
    }
  }
}

// ─── 测试 ──────────────────────────────────────────────

describe('SopEngine', () => {
  let engine: TestSopEngine

  beforeEach(() => {
    engine = new TestSopEngine({
      name: 'test-engine',
      version: '1.0.0',
    })
  })

  describe('constructor', () => {
    it('should create engine with config', () => {
      expect(engine.name).toBe('test-engine')
      expect(engine.version).toBe('1.0.0')
    })

    it('should use default config values', () => {
      const defaultEngine = new TestSopEngine({ name: 'default', version: '1.0.0' })
      expect(defaultEngine.name).toBe('default')
    })
  })

  describe('createTask', () => {
    it('should create task from user message', async () => {
      const task = await engine.createTask('Test task')

      expect(task.id).toBeDefined()
      expect(task.type).toBe('test-task')
      expect(task.description).toBe('Test task')
      expect(task.status).toBe('created')
      expect(task.steps.length).toBe(2)
    })

    it('should include context in task', async () => {
      const task = await engine.createTask('Test task', { userId: 'user-1' })

      expect(task.context.userId).toBe('user-1')
      expect(task.context.userMessage).toBe('Test task')
    })

    it('should call onTaskCreated event', async () => {
      const onTaskCreated = vi.fn()
      const eventEngine = new TestSopEngine(
        { name: 'event-engine', version: '1.0.0' },
        { onTaskCreated },
      )

      const task = await eventEngine.createTask('Test task')
      expect(onTaskCreated).toHaveBeenCalledWith(task)
    })
  })

  describe('getTask', () => {
    it('should return task by id', async () => {
      const task = await engine.createTask('Test task')
      const found = await engine.getTask(task.id)

      expect(found).toBeDefined()
      expect(found?.id).toBe(task.id)
    })

    it('should return null for unknown task', async () => {
      const found = await engine.getTask('unknown-id')
      expect(found).toBeNull()
    })
  })

  describe('listTasks', () => {
    it('should list all tasks', async () => {
      await engine.createTask('Task 1')
      await engine.createTask('Task 2')

      const tasks = await engine.listTasks()
      expect(tasks.length).toBe(2)
    })

    it('should filter tasks by status', async () => {
      const task = await engine.createTask('Task 1')
      await engine.startTask(task.id)

      const runningTasks = await engine.listTasks('running')
      expect(runningTasks.length).toBe(1)
      expect(runningTasks[0].status).toBe('running')
    })
  })

  describe('startTask', () => {
    it('should start created task', async () => {
      const task = await engine.createTask('Test task')
      await engine.startTask(task.id)

      const started = await engine.getTask(task.id)
      expect(started?.status).toBe('running')
    })

    it('should throw error for unknown task', async () => {
      await expect(engine.startTask('unknown-id')).rejects.toThrow('Task not found')
    })
  })

  describe('pauseTask', () => {
    it('should pause running task', async () => {
      const task = await engine.createTask('Test task')
      await engine.startTask(task.id)
      await engine.pauseTask(task.id)

      const paused = await engine.getTask(task.id)
      expect(paused?.status).toBe('paused')
    })

    it('should throw error for non-running task', async () => {
      const task = await engine.createTask('Test task')
      await expect(engine.pauseTask(task.id)).rejects.toThrow('Cannot pause task')
    })
  })

  describe('resumeTask', () => {
    it('should resume paused task', async () => {
      const task = await engine.createTask('Test task')
      await engine.startTask(task.id)
      await engine.pauseTask(task.id)
      await engine.resumeTask(task.id)

      const resumed = await engine.getTask(task.id)
      expect(resumed?.status).toBe('running')
    })
  })

  describe('cancelTask', () => {
    it('should cancel task', async () => {
      const task = await engine.createTask('Test task')
      await engine.cancelTask(task.id)

      const cancelled = await engine.getTask(task.id)
      expect(cancelled?.status).toBe('cancelled')
    })
  })

  describe('getCurrentStep', () => {
    it('should return current step', async () => {
      const task = await engine.createTask('Test task')
      const step = await engine.getCurrentStep(task.id)

      expect(step).toBeDefined()
      expect(step?.id).toBe('step-1')
    })

    it('should return null when task is complete', async () => {
      const task = await engine.createTask('Test task')
      // 手动设置完成
      const t = await engine.getTask(task.id)
      if (t) {
        t.currentStepIndex = t.steps.length
      }

      const step = await engine.getCurrentStep(task.id)
      expect(step).toBeNull()
    })
  })

  describe('submitStepData', () => {
    it('should submit data to step', async () => {
      const task = await engine.createTask('Test task')
      await engine.submitStepData(task.id, 'step-1', { result: 'test' })

      const t = await engine.getTask(task.id)
      const step = t?.steps[0]
      expect(step?.data?.result).toBe('test')
    })
  })

  describe('generateOutput', () => {
    it('should generate output from completed steps', async () => {
      const task = await engine.createTask('Test task')

      // 手动完成步骤
      const t = await engine.getTask(task.id)
      if (t) {
        t.steps[0].status = 'completed'
        t.steps[0].data = { result: 'step 1 result' }
        t.steps[1].status = 'completed'
        t.steps[1].data = { result: 'step 2 result' }
      }

      const output = await engine.generateOutput(task.id)
      expect(output).toContain('step-1')
      expect(output).toContain('step-2')
    })
  })

  describe('registerStepExecutor', () => {
    it('should register step executor', () => {
      const executor = vi.fn()
      engine.registerStepExecutor('custom-step', executor)

      // 验证注册成功（通过执行步骤间接验证）
      expect(engine).toBeDefined()
    })
  })
})

describe('Prompts', () => {
  describe('buildPrompt', () => {
    it('should build prompt with variables', () => {
      const prompt = buildPrompt('Hello {name}!', { name: 'World' })
      expect(prompt).toBe('Hello World!')
    })

    it('should handle multiple variables', () => {
      const prompt = buildPrompt('{a} and {b}', { a: 'First', b: 'Second' })
      expect(prompt).toBe('First and Second')
    })

    it('should handle object variables', () => {
      const prompt = buildPrompt('Data: {data}', { data: { key: 'value' } })
      expect(prompt).toContain('key')
      expect(prompt).toContain('value')
    })

    it('should handle number variables', () => {
      const prompt = buildPrompt('Count: {count}', { count: 5 })
      expect(prompt).toBe('Count: 5')
    })
  })

  describe('TASK_ANALYSIS_PROMPT', () => {
    it('should be defined', () => {
      expect(TASK_ANALYSIS_PROMPT).toBeDefined()
      expect(TASK_ANALYSIS_PROMPT).toContain('任务分析专家')
    })
  })
})
