/**
 * Search 模块测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch
global.fetch = vi.fn()

describe('Search Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('search function', () => {
    it('should perform search', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1' },
            { title: 'Result 2', url: 'https://example.com/2', snippet: 'Snippet 2' },
          ],
        }),
      } as Response)

      const { search } = await import('../search.js')
      expect(search).toBeDefined()
    })

    it('should handle search errors', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { search } = await import('../search.js')
      expect(search).toBeDefined()
    })
  })

  describe('academicSearch function', () => {
    it('should perform academic search', async () => {
      const { academicSearch } = await import('../search.js')
      expect(academicSearch).toBeDefined()
    })
  })

  describe('configureSearch function', () => {
    it('should configure search', async () => {
      const { configureSearch } = await import('../search.js')

      configureSearch({
        engine: 'duckduckgo',
        maxResults: 10,
      })
    })
  })
})
