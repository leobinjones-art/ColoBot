/**
 * 心跳协议测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HeartbeatMonitor, HeartbeatSender } from '../heartbeat.js'

describe('Heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

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

    it('should detect dead agent after missed beats', () => {
      const onDead = vi.fn()
      const monitor = new HeartbeatMonitor({ interval: 1000, missedThreshold: 3 })
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

      // 推进时间超过阈值
      vi.advanceTimersByTime(7000)

      expect(onDead).toHaveBeenCalledWith('agent-1')

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
    it('should send heartbeat periodically', () => {
      const onSend = vi.fn()
      const sender = new HeartbeatSender('agent-1', { interval: 1000 })
      sender.setOnSend(onSend)
      sender.start()

      vi.advanceTimersByTime(2500)

      expect(onSend).toHaveBeenCalledTimes(2)

      sender.stop()
    })

    it('should include status in heartbeat', () => {
      const onSend = vi.fn()
      const sender = new HeartbeatSender('agent-1', { interval: 1000 })
      sender.setOnSend(onSend)
      sender.setStatus('busy')
      sender.setSessionCount(3)
      sender.start()

      vi.advanceTimersByTime(1100)

      expect(onSend).toHaveBeenCalled()
      const heartbeat = onSend.mock.calls[0][0]
      expect(heartbeat.status).toBe('busy')
      expect(heartbeat.currentSessionCount).toBe(3)

      sender.stop()
    })
  })
})
