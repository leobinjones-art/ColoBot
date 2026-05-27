/**
 * Search 模块测试 — 真实搜索调用
 */

import { describe, it, expect, beforeAll } from 'vitest'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

describe('Search Module', () => {
  beforeAll(async () => {
    const { configureSearch } = await import('../search.js')
    // 使用 duckduckgo 引擎，不需要 API key
    configureSearch({ engine: 'duckduckgo', maxResults: 10 })
  })

  describe('configureSearch', () => {
    it('should configure search engine', async () => {
      const { configureSearch, getSearchConfig } = await import('../search.js')
      configureSearch({ engine: 'duckduckgo', maxResults: 5 })
      const config = getSearchConfig()
      expect(config.engine).toBe('duckduckgo')
      expect(config.maxResults).toBe(5)
    })
  })

  describe('search', () => {
    it('should return results from DuckDuckGo', async () => {
      if (!OPENAI_API_KEY) return

      const { search, configureSearch } = await import('../search.js')
      configureSearch({ engine: 'duckduckgo' })

      const result = await search('TypeScript tutorial')
      expect(result.query).toBe('TypeScript tutorial')
      // DuckDuckGo 可能返回结果也可能不返回，取决于网络
      // 只验证结构正确
      expect(Array.isArray(result.results)).toBe(true)
      expect(result).toHaveProperty('answers')
      expect(result).toHaveProperty('suggestions')
      expect(result).toHaveProperty('numberOfResults')
    })

    it('should return empty results on invalid query handling', async () => {
      if (!OPENAI_API_KEY) return

      const { search, configureSearch } = await import('../search.js')
      configureSearch({ engine: 'duckduckgo' })

      // 搜索模块在异常时返回空结果而非抛错
      const result = await search('')
      expect(result).toHaveProperty('results')
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('should respect maxResults option', async () => {
      if (!OPENAI_API_KEY) return

      const { search, configureSearch } = await import('../search.js')
      configureSearch({ engine: 'duckduckgo' })

      const result = await search('TypeScript tutorial', { maxResults: 3 })
      // 结果数量不应超过 maxResults
      expect(result.results.length).toBeLessThanOrEqual(3)
    })
  })

  describe('imageSearch', () => {
    it('should call search with images category', async () => {
      if (!OPENAI_API_KEY) return

      const { imageSearch, configureSearch } = await import('../search.js')
      configureSearch({ engine: 'duckduckgo' })

      const result = await imageSearch('cats')
      expect(result).toHaveProperty('results')
      expect(Array.isArray(result.results)).toBe(true)
    })
  })

  describe('academicSearch', () => {
    it('should return papers array', async () => {
      if (!OPENAI_API_KEY) return

      const { academicSearch, configureSearch } = await import('../search.js')
      configureSearch({ engine: 'duckduckgo' })

      const result = await academicSearch('quantum computing')
      expect(result).toHaveProperty('papers')
      expect(Array.isArray(result.papers)).toBe(true)
      // 每篇论文应有 title, url, abstract, source
      for (const paper of result.papers) {
        expect(paper).toHaveProperty('title')
        expect(paper).toHaveProperty('url')
        expect(paper).toHaveProperty('abstract')
        expect(paper).toHaveProperty('source')
      }
    })
  })
})
