/**
 * 会话超时监控测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SessionTimeoutMonitor,
  SessionTimeoutConfig,
  defaultTimeoutMessages,
  TimeoutStage,
} from '../timeout-monitor.js'

describe('SessionTimeoutMonitor', () => {
  let monitor: SessionTimeoutMonitor

  beforeEach(() => {
    monitor = new SessionTimeoutMonitor({
      warningMs: 1000, // 1s 警告
      promptMs: 2000, // 2s 提示
      takeoverMs: 3000, // 3s 接管
      checkIntervalMs: 500, // 500ms 检查
    })
  })

  afterEach(() => {
    monitor.stop()
  })

  describe('startSession', () => {
    it('should start monitoring a session', () => {
      monitor.startSession('session-1', 'agent-1')
      const state = monitor.getSessionState('session-1')
      expect(state).toBeDefined()
      expect(state?.sessionId).toBe('session-1')
      expect(state?.agentId).toBe('agent-1')
      expect(state?.stage).toBe('normal')
    })
  })

  describe('touchSession', () => {
    it('should reset timeout timer', async () => {
      monitor.startSession('session-1', 'agent-1')
      monitor.start()

      // 等待接近警告时间
      await new Promise((r) => setTimeout(r, 900))

      // 触摸重置
      monitor.touchSession('session-1')

      // 再等待，应该还是 normal
      await new Promise((r) => setTimeout(r, 600))

      const state = monitor.getSessionState('session-1')
      expect(state?.stage).toBe('normal')
    })

    it('should reset from warning stage', async () => {
      monitor.startSession('session-1', 'agent-1')
      monitor.start()

      // 等待进入警告阶段
      await new Promise((r) => setTimeout(r, 1200))

      const state1 = monitor.getSessionState('session-1')
      expect(state1?.stage).toBe('warning')

      // 触摸重置
      monitor.touchSession('session-1')

      const state2 = monitor.getSessionState('session-1')
      expect(state2?.stage).toBe('normal')
    })
  })

  describe('endSession', () => {
    it('should remove session from monitoring', () => {
      monitor.startSession('session-1', 'agent-1')
      monitor.endSession('session-1')
      const state = monitor.getSessionState('session-1')
      expect(state).toBeUndefined()
    })
  })

  describe('timeout stages', () => {
    it('should progress through warning -> prompt -> takeover', async () => {
      const messages: Array<{ stage: string; message: string }> = []

      monitor.setCallbacks({
        onWarning: (sid, elapsed) => `Warning: ${elapsed}ms`,
        onPrompt: (sid, elapsed) => `Prompt: ${elapsed}ms`,
        onTakeover: (sid, elapsed) => `Takeover: ${elapsed}ms`,
      })

      monitor.startSession('session-1', 'agent-1')
      monitor.start()

      // 等待警告
      await new Promise((r) => setTimeout(r, 1200))
      const state1 = monitor.getSessionState('session-1')
      expect(state1?.stage).toBe('warning')

      // 等待提示
      await new Promise((r) => setTimeout(r, 1200))
      const state2 = monitor.getSessionState('session-1')
      expect(state2?.stage).toBe('prompt')

      // 等待接管
      await new Promise((r) => setTimeout(r, 1200))
      const state3 = monitor.getSessionState('session-1')
      expect(state3?.stage).toBe('takeover')
    })
  })

  describe('getPendingMessages', () => {
    it('should return pending messages and clear them', async () => {
      monitor.setCallbacks({
        onWarning: () => 'Warning message',
        onPrompt: () => 'Prompt message',
      })

      monitor.startSession('session-1', 'agent-1')
      monitor.start()

      // 等待警告
      await new Promise((r) => setTimeout(r, 1200))

      const messages1 = monitor.getPendingMessages()
      expect(messages1.length).toBe(1)
      expect(messages1[0].stage).toBe('warning')
      expect(messages1[0].message).toBe('Warning message')

      // 再次获取应该为空（已清除）
      const messages2 = monitor.getPendingMessages()
      expect(messages2.length).toBe(0)
    })
  })

  describe('getTimeoutSessions', () => {
    it('should return sessions in non-normal stage', async () => {
      monitor.startSession('session-1', 'agent-1')
      // session-2 延迟创建，避免同时进入警告
      await new Promise((r) => setTimeout(r, 600))
      monitor.startSession('session-2', 'agent-1')
      monitor.start()

      // 等待 session-1 进入警告，但 session-2 还没
      await new Promise((r) => setTimeout(r, 700))

      const timeoutSessions = monitor.getTimeoutSessions()
      expect(timeoutSessions.length).toBe(1)
      expect(timeoutSessions[0].sessionId).toBe('session-1')
    })
  })
})

describe('defaultTimeoutMessages', () => {
  it('should generate warning message with elapsed time', () => {
    const msg = defaultTimeoutMessages.onWarning('session-1', 30000)
    expect(msg).toContain('30 秒')
    expect(msg).toContain('正在处理中')
  })

  it('should generate prompt message with elapsed time', () => {
    const msg = defaultTimeoutMessages.onPrompt('session-1', 60000)
    expect(msg).toContain('60 秒')
    expect(msg).toContain('继续等待')
  })

  it('should generate takeover message with elapsed time', () => {
    const msg = defaultTimeoutMessages.onTakeover('session-1', 120000)
    expect(msg).toContain('120 秒')
    expect(msg).toContain('超时')
  })
})
