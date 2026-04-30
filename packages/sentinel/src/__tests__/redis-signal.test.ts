/**
 * Redis Pub/Sub 信号总线测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MockRedisClient } from '../redis-store.js'
import { RedisSignalBus, RedisTakeoverManager, RedisSignalReceiver } from '../redis-signal.js'
import type { TakeoverSignal, ResumeSignal } from '../signal.js'

describe('RedisSignalBus', () => {
  let client: MockRedisClient
  let signalBus: RedisSignalBus

  beforeEach(() => {
    client = new MockRedisClient()
    signalBus = new RedisSignalBus(client)
  })

  afterEach(async () => {
    await signalBus.unsubscribeAll()
    await client.quit()
  })

  describe('publish/subscribe', () => {
    it('should publish and receive takeover signal', async () => {
      const received: TakeoverSignal[] = []
      await signalBus.subscribeTakeover((signal) => {
        received.push(signal)
      })

      const signal: TakeoverSignal = {
        type: 'takeover',
        sessionId: 'session-1',
        reason: 'timeout',
        action: 'terminate',
        timestamp: Date.now(),
      }

      await signalBus.publishTakeover(signal)

      expect(received.length).toBe(1)
      expect(received[0].sessionId).toBe('session-1')
    })

    it('should publish and receive resume signal', async () => {
      const received: ResumeSignal[] = []
      await signalBus.subscribeResume((signal) => {
        received.push(signal)
      })

      const signal: ResumeSignal = {
        type: 'resume',
        sessionId: 'session-1',
        timestamp: Date.now(),
      }

      await signalBus.publishResume(signal)

      expect(received.length).toBe(1)
      expect(received[0].sessionId).toBe('session-1')
    })

    it('should support multiple handlers', async () => {
      const received1: TakeoverSignal[] = []
      const received2: TakeoverSignal[] = []

      await signalBus.subscribeTakeover((signal) => {
        received1.push(signal)
      })
      await signalBus.subscribeTakeover((signal) => {
        received2.push(signal)
      })

      const signal: TakeoverSignal = {
        type: 'takeover',
        sessionId: 'session-1',
        reason: 'timeout',
        action: 'terminate',
        timestamp: Date.now(),
      }

      await signalBus.publishTakeover(signal)

      expect(received1.length).toBe(1)
      expect(received2.length).toBe(1)
    })

    it('should unsubscribe', async () => {
      const received: TakeoverSignal[] = []
      await signalBus.subscribeTakeover((signal) => {
        received.push(signal)
      })

      await signalBus.unsubscribe('takeover')

      const signal: TakeoverSignal = {
        type: 'takeover',
        sessionId: 'session-1',
        reason: 'timeout',
        action: 'terminate',
        timestamp: Date.now(),
      }

      await signalBus.publishTakeover(signal)

      expect(received.length).toBe(0)
    })
  })
})

describe('RedisTakeoverManager', () => {
  let client: MockRedisClient
  let signalBus: RedisSignalBus
  let manager: RedisTakeoverManager

  beforeEach(() => {
    client = new MockRedisClient()
    signalBus = new RedisSignalBus(client)
    manager = new RedisTakeoverManager(signalBus)
  })

  afterEach(async () => {
    await signalBus.unsubscribeAll()
    await client.quit()
  })

  describe('trigger', () => {
    it('should trigger takeover', async () => {
      const received: TakeoverSignal[] = []
      await signalBus.subscribeTakeover((signal) => {
        received.push(signal)
      })

      await manager.trigger('session-1', 'timeout')

      expect(received.length).toBe(1)
      expect(received[0].sessionId).toBe('session-1')
      expect(received[0].reason).toBe('timeout')
    })

    it('should call onTakeover callback', async () => {
      const messages: string[] = []
      manager.setOnTakeover((signal) => {
        messages.push(`Takeover: ${signal.sessionId}`)
        return 'Takeover message'
      })

      const result = await manager.trigger('session-1', 'timeout')
      expect(result).toBe('Takeover message')
    })
  })
})

describe('RedisSignalReceiver', () => {
  let client: MockRedisClient
  let signalBus: RedisSignalBus
  let receiver: RedisSignalReceiver

  beforeEach(() => {
    client = new MockRedisClient()
    signalBus = new RedisSignalBus(client)
    receiver = new RedisSignalReceiver(signalBus, 'agent-1')
  })

  afterEach(async () => {
    await receiver.stop()
    await client.quit()
  })

  describe('onTakeover', () => {
    it('should receive takeover signal', async () => {
      const received: TakeoverSignal[] = []
      await receiver.onTakeover((signal) => {
        received.push(signal)
      })

      const signal: TakeoverSignal = {
        type: 'takeover',
        sessionId: 'session-1',
        reason: 'timeout',
        action: 'terminate',
        timestamp: Date.now(),
      }

      await signalBus.publishTakeover(signal)

      expect(received.length).toBe(1)
    })
  })

  describe('onResume', () => {
    it('should receive resume signal', async () => {
      const received: ResumeSignal[] = []
      await receiver.onResume((signal) => {
        received.push(signal)
      })

      const signal: ResumeSignal = {
        type: 'resume',
        sessionId: 'session-1',
        timestamp: Date.now(),
      }

      await signalBus.publishResume(signal)

      expect(received.length).toBe(1)
    })
  })

  describe('sendAck', () => {
    it('should send ack signal', async () => {
      const received: unknown[] = []
      await signalBus.subscribeAck((signal) => {
        received.push(signal)
      })

      const takeoverSignal: TakeoverSignal = {
        type: 'takeover',
        sessionId: 'session-1',
        reason: 'timeout',
        action: 'terminate',
        timestamp: Date.now(),
      }

      await receiver.sendAck(takeoverSignal)

      expect(received.length).toBe(1)
    })
  })
})
