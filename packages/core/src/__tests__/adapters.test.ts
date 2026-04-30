/**
 * Adapters 模块测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Adapters Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('InMemoryStore', () => {
    it('should store and retrieve data', async () => {
      const { InMemoryStore } = await import('../adapters/memory.js')
      const store = new InMemoryStore()

      await store.append('agent-1', 'session-1', 'user', 'Hello')
      const history = await store.getHistory('agent-1', 'session-1')
      expect(history).toHaveLength(1)
      expect(history[0]?.content).toBe('Hello')
    })

    it('should delete data', async () => {
      const { InMemoryStore } = await import('../adapters/memory.js')
      const store = new InMemoryStore()

      await store.append('agent-1', 'session-1', 'user', 'Hello')
      await store.clear('agent-1', 'session-1')
      const history = await store.getHistory('agent-1', 'session-1')
      expect(history).toHaveLength(0)
    })

    it('should list all messages', async () => {
      const { InMemoryStore } = await import('../adapters/memory.js')
      const store = new InMemoryStore()

      await store.append('agent-1', 'session-1', 'user', 'Message 1')
      await store.append('agent-1', 'session-1', 'assistant', 'Message 2')
      const history = await store.getHistory('agent-1', 'session-1')
      expect(history).toHaveLength(2)
    })

    it('should clear all data', async () => {
      const { InMemoryStore } = await import('../adapters/memory.js')
      const store = new InMemoryStore()

      await store.append('agent-1', 'session-1', 'user', 'Message 1')
      await store.clear('agent-1', 'session-1')
      const history = await store.getHistory('agent-1', 'session-1')
      expect(history).toHaveLength(0)
    })
  })

  describe('ConsoleAudit', () => {
    it('should log audit entries', async () => {
      const { ConsoleAudit } = await import('../adapters/audit.js')
      const audit = new ConsoleAudit()

      await audit.write({
        actorType: 'agent',
        actorId: 'agent-1',
        action: 'test',
        targetType: 'resource',
        targetId: 'test-resource',
        result: 'success',
      })
      // ConsoleAudit just logs to console, no return value
    })
  })

  describe('ConsolePusher', () => {
    it('should push messages', async () => {
      const { ConsolePusher } = await import('../adapters/pusher.js')
      const pusher = new ConsolePusher()

      await pusher.pushResult('agent-1', 'session-1', { type: 'message', content: 'test' })
      // ConsolePusher just logs to console
    })
  })

  describe('InMemoryStateStore', () => {
    it('should store state', async () => {
      const { InMemoryStateStore } = await import('../adapters/state.js')
      const store = new InMemoryStateStore()

      await store.save('agent-1', 'session-1', { step: 1 })
      const state = await store.load('agent-1', 'session-1')
      expect((state as { step: number })?.step).toBe(1)
    })

    it('should clear state', async () => {
      const { InMemoryStateStore } = await import('../adapters/state.js')
      const store = new InMemoryStateStore()

      await store.save('agent-1', 'session-1', { step: 1 })
      await store.delete('agent-1', 'session-1')
      const state = await store.load('agent-1', 'session-1')
      expect(state).toBeNull()
    })
  })

  describe('LocalFileSystemAdapter', () => {
    it('should read files', async () => {
      const { LocalFileSystemAdapter } = await import('../adapters/filesystem.js')
      const fs = new LocalFileSystemAdapter()

      // 验证方法存在
      expect(fs.write).toBeDefined()
      expect(fs.read).toBeDefined()
      expect(fs.list).toBeDefined()
      expect(fs.delete).toBeDefined()
    })
  })
})