/**
 * 接管信号测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignalBus, TakeoverManager, SignalReceiver, resetSignalBus } from '../signal.js'

describe('Signal', () => {
  let bus: SignalBus

  beforeEach(() => {
    bus = resetSignalBus()
  })

  describe('SignalBus', () => {
    it('should send and receive takeover signal', () => {
      const handler = vi.fn()
      bus.subscribe('agent-1', handler)

      bus.sendTakeover({
        type: 'takeover',
        sessionId: 'session-1',
        reason: 'timeout',
        action: 'terminate',
        timestamp: Date.now(),
      })

      expect(handler).toHaveBeenCalled()
    })

    it('should handle multiple subscribers', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      bus.subscribe('agent-1', handler1)
      bus.subscribe('agent-2', handler2)

      bus.sendTakeover({
        type: 'takeover',
        sessionId: 'session-1',
        reason: 'timeout',
        action: 'terminate',
        timestamp: Date.now(),
      })

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('should support unsubscribe', () => {
      const handler = vi.fn()
      const unsubscribe = bus.subscribe('agent-1', handler)

      bus.sendTakeover({
        type: 'takeover',
        sessionId: 'session-1',
        reason: 'timeout',
        action: 'terminate',
        timestamp: Date.now(),
      })
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()

      bus.sendTakeover({
        type: 'takeover',
        sessionId: 'session-2',
        reason: 'timeout',
        action: 'terminate',
        timestamp: Date.now(),
      })
      expect(handler).toHaveBeenCalledTimes(1) // 仍然是 1
    })
  })

  describe('TakeoverManager', () => {
    it('should trigger takeover with message', () => {
      const manager = new TakeoverManager(bus)

      const message = manager.trigger('session-1', 'timeout')
      expect(message).toContain('时间过长')

      const pending = bus.getPending('session-1')
      expect(pending).toBeDefined()
      expect(pending?.type).toBe('takeover')
    })

    it('should use custom takeover callback', () => {
      const manager = new TakeoverManager(bus)
      manager.setOnTakeover(() => 'Custom takeover message')

      const message = manager.trigger('session-1', 'timeout')
      expect(message).toBe('Custom takeover message')
    })
  })

  describe('SignalReceiver', () => {
    it('should receive signals', () => {
      const onTakeover = vi.fn()
      const receiver = new SignalReceiver(bus, 'agent-1')

      receiver.start({ onTakeover })

      bus.sendTakeover({
        type: 'takeover',
        sessionId: 'session-1',
        reason: 'timeout',
        action: 'terminate',
        timestamp: Date.now(),
      })

      expect(onTakeover).toHaveBeenCalled()

      receiver.stop()
    })
  })
})
