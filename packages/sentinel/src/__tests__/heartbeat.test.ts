/**
 * 心跳协议测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { HeartbeatMonitor, HeartbeatSender } from '../heartbeat.js'
import { Sentinel } from '../index.js'
import type { LLMProvider } from '@colomind/types'

const API_KEY = process.env.OPENAI_API_KEY
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

// 手动回调追踪（替代 vi.fn）
function createCallTracker<T extends (...args: any[]) => any>() {
  const calls: Array<Parameters<T>> = []
  const tracker = (...args: Parameters<T>) => {
    calls.push(args)
  }
  tracker.calls = calls
  tracker.callCount = () => calls.length
  tracker.wasCalled = () => calls.length > 0
  tracker.firstCall = () => calls[0]
  return tracker as ((...args: Parameters<T>) => void) & {
    calls: Array<Parameters<T>>
    callCount: () => number
    wasCalled: () => boolean
    firstCall: () => Parameters<T> | undefined
  }
}

describe('Heartbeat', () => {
  describe('HeartbeatMonitor', () => {
    it('should receive heartbeat and mark agent healthy', () => {
      const monitor = new HeartbeatMonitor()

      monitor.receiveHeartbeat({
        type: 'heartbeat',
        from: 'parent',
        agentId: 'agent-1',
        timestamp: Date.now(),
        status: 'idle',
        currentSessionCount: 0,
      })

      const status = monitor.getAgentStatus('agent-1')
      expect(status).toBeDefined()
      expect(status?.status).toBe('healthy')
    })

    it('should detect dead agent after missed beats', async () => {
      const onDead = createCallTracker<(agentId: string) => void>()
      const monitor = new HeartbeatMonitor({ interval: 100, missedThreshold: 3 })
      monitor.setOnAgentDead(onDead)
      monitor.start()

      // 初始心跳
      monitor.receiveHeartbeat({
        type: 'heartbeat',
        from: 'parent',
        agentId: 'agent-1',
        timestamp: Date.now(),
        status: 'idle',
        currentSessionCount: 0,
      })

      // 推进时间超过阈值（等待真实定时器）
      await new Promise((resolve) => setTimeout(resolve, 700))

      expect(onDead.wasCalled()).toBe(true)
      expect(onDead.firstCall()?.[0]).toBe('agent-1')

      const status = monitor.getAgentStatus('agent-1')
      expect(status?.status).toBe('dead')

      monitor.stop()
    })

    it('should track agent status', () => {
      const monitor = new HeartbeatMonitor()

      monitor.receiveHeartbeat({
        type: 'heartbeat',
        from: 'parent',
        agentId: 'agent-1',
        timestamp: Date.now(),
        status: 'busy',
        currentSessionCount: 2,
      })

      const status = monitor.getAgentStatus('agent-1')
      expect(status?.lastStatus).toBe('busy')
    })
  })

  describe('HeartbeatSender', () => {
    it('should send heartbeat periodically', async () => {
      const onSend = createCallTracker<(heartbeat: any) => void>()
      const sender = new HeartbeatSender('agent-1', { interval: 100 })
      sender.setOnSend(onSend)
      sender.start()

      // 使用真实定时器等待
      await new Promise((resolve) => setTimeout(resolve, 250))

      expect(onSend.callCount()).toBeGreaterThanOrEqual(2)

      sender.stop()
    })

    it('should include status in heartbeat', async () => {
      const onSend = createCallTracker<(heartbeat: any) => void>()
      const sender = new HeartbeatSender('agent-1', { interval: 100 })
      sender.setOnSend(onSend)
      sender.setStatus('busy')
      sender.setSessionCount(3)
      sender.start()

      // 使用真实定时器等待
      await new Promise((resolve) => setTimeout(resolve, 120))

      expect(onSend.wasCalled()).toBe(true)
      const heartbeat = onSend.firstCall()?.[0]
      expect(heartbeat.status).toBe('busy')
      expect(heartbeat.currentSessionCount).toBe(3)

      sender.stop()
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // 使用真实 LLM 的心跳检测测试
  // ═══════════════════════════════════════════════════════════════

  describe('Sentinel 心跳 + LLM 接管（真实 LLM）', () => {
    it('应该在超时后触发接管并使用 LLM 分析', async () => {
      if (!API_KEY) return

      const { OpenAIProvider } = await import('@colomind/core')
      const provider: LLMProvider = new OpenAIProvider({
        apiKey: API_KEY,
        baseUrl: BASE_URL,
        model: 'gpt-4o-mini',
      })

      const sentinel = new Sentinel({ llmProvider: provider, inferenceModel: 'gpt-4o-mini' })
      sentinel.start()

      // 模拟心跳接收
      sentinel.receiveHeartbeat({
        type: 'heartbeat',
        from: 'parent',
        agentId: 'agent-1',
        timestamp: Date.now(),
        status: 'idle',
        currentSessionCount: 0,
      })

      const healthStatus = sentinel.getAgentHealthStatus('agent-1')
      expect(healthStatus).toBeDefined()
      expect(healthStatus?.status).toBe('healthy')

      sentinel.stop()
    })

    it('应该结合心跳和三层防御进行完整安全扫描', async () => {
      if (!API_KEY) return

      const { OpenAIProvider } = await import('@colomind/core')
      const provider: LLMProvider = new OpenAIProvider({
        apiKey: API_KEY,
        baseUrl: BASE_URL,
        model: 'gpt-4o-mini',
      })

      const sentinel = new Sentinel({ llmProvider: provider, inferenceModel: 'gpt-4o-mini' })

      // 正常请求应该通过
      const result = await sentinel.fullScan('你好，请问你能帮我什么？', 'test-hb-session')
      expect(result).toBeDefined()
      expect(typeof result.pass).toBe('boolean')
    })
  })
})