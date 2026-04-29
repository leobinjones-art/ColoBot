/**
 * Memory 模块测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}))

describe('Memory Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Vector Memory', () => {
    it('should add memory', async () => {
      const { addMemory } = await import('../memory/vector.js')
      const { query } = await import('../memory/db.js')

      vi.mocked(query).mockResolvedValueOnce([{ id: 'mem-1' }])

      const result = await addMemory('agent-1', 'test-key', 'test content', {
        metadata: { source: 'test' },
      })

      expect(query).toHaveBeenCalled()
    })

    it('should search memory', async () => {
      const { searchMemory } = await import('../memory/vector.js')
      const { query } = await import('../memory/db.js')

      vi.mocked(query).mockResolvedValueOnce([
        {
          id: 'mem-1',
          agent_id: 'agent-1',
          memory_key: 'test',
          content: 'test content',
          embedding: '[0.1, 0.2, 0.3]',
          created_at: new Date().toISOString(),
        },
      ])

      const results = await searchMemory('agent-1', 'test', 5)
      expect(query).toHaveBeenCalled()
    })

    it('should list memory', async () => {
      const { listMemory } = await import('../memory/vector.js')
      const { query } = await import('../memory/db.js')

      vi.mocked(query).mockResolvedValueOnce([])

      const results = await listMemory('agent-1')
      expect(query).toHaveBeenCalled()
    })
  })

  describe('Embeddings', () => {
    it('should generate embeddings', async () => {
      const { embed, configureEmbedding } = await import('../memory/embeddings.js')

      configureEmbedding({ provider: 'mock' })
      const result = await embed('test content')

      expect(result.embedding).toBeDefined()
      expect(result.embedding?.length).toBe(1536)
    })
  })

  describe('Layered Memory', () => {
    it('should export layered memory functions', async () => {
      const layered = await import('../memory/layered.js')

      expect(layered.addLongTermMemory).toBeDefined()
      expect(layered.searchLongTermMemory).toBeDefined()
      expect(layered.addEpisodicMemory).toBeDefined()
      expect(layered.searchEpisodicMemory).toBeDefined()
      expect(layered.addWorkingMemory).toBeDefined()
      expect(layered.getWorkingMemory).toBeDefined()
      expect(layered.searchAllMemory).toBeDefined()
    })
  })
})
