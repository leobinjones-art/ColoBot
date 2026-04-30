/**
 * Redis 共享状态测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MockRedisClient, RedisStateStore } from '../redis-store.js'
import type { SessionState, AgentHealthStatus } from '../index.js'

describe('MockRedisClient', () => {
  let client: MockRedisClient

  beforeEach(() => {
    client = new MockRedisClient()
  })

  afterEach(async () => {
    await client.quit()
  })

  describe('get/set', () => {
    it('should set and get value', async () => {
      await client.set('key1', 'value1')
      const result = await client.get('key1')
      expect(result).toBe('value1')
    })

    it('should return null for non-existent key', async () => {
      const result = await client.get('nonexistent')
      expect(result).toBeNull()
    })

    it('should support TTL', async () => {
      await client.set('key1', 'value1', 1) // 1 秒 TTL
      const result1 = await client.get('key1')
      expect(result1).toBe('value1')

      // 等待过期
      await new Promise((r) => setTimeout(r, 1100))
      const result2 = await client.get('key1')
      expect(result2).toBeNull()
    })
  })

  describe('del', () => {
    it('should delete key', async () => {
      await client.set('key1', 'value1')
      await client.del('key1')
      const result = await client.get('key1')
      expect(result).toBeNull()
    })
  })

  describe('keys', () => {
    it('should return matching keys', async () => {
      await client.set('session:1', 'data1')
      await client.set('session:2', 'data2')
      await client.set('agent:1', 'data3')

      const keys = await client.keys('session:*')
      expect(keys.length).toBe(2)
      expect(keys).toContain('session:1')
      expect(keys).toContain('session:2')
    })
  })

  describe('expire/ttl', () => {
    it('should set expiration', async () => {
      await client.set('key1', 'value1')
      await client.expire('key1', 10)
      const ttl = await client.ttl('key1')
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(10)
    })
  })

  describe('pub/sub', () => {
    it('should publish and receive messages', async () => {
      const messages: string[] = []
      await client.subscribe('channel1', (msg) => {
        messages.push(msg)
      })

      await client.publish('channel1', 'message1')
      await client.publish('channel1', 'message2')

      expect(messages.length).toBe(2)
      expect(messages).toContain('message1')
      expect(messages).toContain('message2')
    })

    it('should unsubscribe', async () => {
      const messages: string[] = []
      await client.subscribe('channel1', (msg) => {
        messages.push(msg)
      })

      await client.publish('channel1', 'message1')
      await client.unsubscribe('channel1')
      await client.publish('channel1', 'message2')

      expect(messages.length).toBe(1)
    })
  })
})

describe('RedisStateStore', () => {
  let client: MockRedisClient
  let store: RedisStateStore

  beforeEach(() => {
    client = new MockRedisClient()
    store = new RedisStateStore(client, { keyPrefix: 'test:' })
  })

  afterEach(async () => {
    await client.quit()
  })

  describe('SessionState', () => {
    const sessionState: SessionState = {
      sessionId: 'session-1',
      agentId: 'agent-1',
      lastUserMessage: 'Hello',
      lastParentResponse: null,
      currentTask: 'Processing',
      taskProgress: 50,
      lastCheckpoint: null,
      status: 'processing',
      updatedAt: Date.now(),
    }

    it('should save and get session state', async () => {
      await store.saveSessionState(sessionState)
      const result = await store.getSessionState('session-1')
      expect(result).not.toBeNull()
      expect(result?.sessionId).toBe('session-1')
      expect(result?.agentId).toBe('agent-1')
    })

    it('should delete session state', async () => {
      await store.saveSessionState(sessionState)
      await store.deleteSessionState('session-1')
      const result = await store.getSessionState('session-1')
      expect(result).toBeNull()
    })

    it('should get sessions by agent', async () => {
      await store.saveSessionState(sessionState)
      await store.saveSessionState({
        ...sessionState,
        sessionId: 'session-2',
      })
      await store.saveSessionState({
        ...sessionState,
        sessionId: 'session-3',
        agentId: 'agent-2',
      })

      const sessions = await store.getSessionsByAgent('agent-1')
      expect(sessions.length).toBe(2)
    })
  })

  describe('AgentHealth', () => {
    const healthStatus: AgentHealthStatus = {
      agentId: 'agent-1',
      lastHeartbeat: Date.now(),
      missedBeats: 0,
      status: 'healthy',
      lastStatus: 'idle',
    }

    it('should save and get agent health', async () => {
      await store.saveAgentHealth(healthStatus)
      const result = await store.getAgentHealth('agent-1')
      expect(result).not.toBeNull()
      expect(result?.agentId).toBe('agent-1')
      expect(result?.status).toBe('healthy')
    })

    it('should get all agent health', async () => {
      await store.saveAgentHealth(healthStatus)
      await store.saveAgentHealth({
        ...healthStatus,
        agentId: 'agent-2',
      })

      const all = await store.getAllAgentHealth()
      expect(all.length).toBe(2)
    })

    it('should delete agent health', async () => {
      await store.saveAgentHealth(healthStatus)
      await store.deleteAgentHealth('agent-1')
      const result = await store.getAgentHealth('agent-1')
      expect(result).toBeNull()
    })
  })

  describe('clear', () => {
    it('should clear all data', async () => {
      await store.saveSessionState({
        sessionId: 'session-1',
        agentId: 'agent-1',
        lastUserMessage: 'Hello',
        lastParentResponse: null,
        currentTask: '',
        taskProgress: 0,
        lastCheckpoint: null,
        status: 'processing',
        updatedAt: Date.now(),
      })
      await store.saveAgentHealth({
        agentId: 'agent-1',
        lastHeartbeat: Date.now(),
        missedBeats: 0,
        status: 'healthy',
        lastStatus: 'idle',
      })

      await store.clear()

      const sessions = await store.getSessionsByAgent('agent-1')
      const health = await store.getAgentHealth('agent-1')

      expect(sessions.length).toBe(0)
      expect(health).toBeNull()
    })
  })
})
