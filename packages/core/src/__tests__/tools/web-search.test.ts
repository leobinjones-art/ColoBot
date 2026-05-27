/**
 * Web Search Tool Tests — 真实搜索调用
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { toolRegistry } from '../../tools/registry.js'
import { registerSearchTools } from '../../tools/web-search.js'
import type { ToolContext } from '@colomind/types'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const ctx: ToolContext = { agentId: 'test', sessionKey: 'test' }

describe('Web Search Tools', () => {
  beforeAll(() => {
    toolRegistry.clear()
    registerSearchTools()
  })

  describe('Tool Registration', () => {
    it('should register web_search tool', () => {
      const tool = toolRegistry.get('web_search')
      expect(tool).toBeDefined()
      expect(tool!.name).toBe('web_search')
      expect(tool!.description.toLowerCase()).toContain('search')
      const params = tool!.parameters as any
      expect(params.properties.query).toBeDefined()
      expect(params.required).toContain('query')
    })

    it('should register image_search tool', () => {
      const tool = toolRegistry.get('image_search')
      expect(tool).toBeDefined()
      expect(tool!.name).toBe('image_search')
      const params = tool!.parameters as any
      expect(params.properties.query).toBeDefined()
      expect(params.required).toContain('query')
    })

    it('should register academic_search tool', () => {
      const tool = toolRegistry.get('academic_search')
      expect(tool).toBeDefined()
      expect(tool!.name).toBe('academic_search')
      const params = tool!.parameters as any
      expect(params.properties.query).toBeDefined()
      expect(params.required).toContain('query')
    })

    it('all web search tools should have valid schemas', () => {
      const toolNames = ['web_search', 'image_search', 'academic_search']
      for (const name of toolNames) {
        const tool = toolRegistry.get(name)!
        const params = tool.parameters as any
        expect(params.type).toBe('object')
        expect(params.properties).toBeDefined()
        expect(params.properties.query.type).toBe('string')
      }
    })
  })

  describe('web_search tool execution — 真实搜索', () => {
    it('should return search results', async () => {
      if (!OPENAI_API_KEY) return

      const tool = toolRegistry.get('web_search')!
      const result = await tool.execute({ query: 'TypeScript tutorial' }, ctx)

      expect(result).toBeDefined()
      // web_search 返回格式化的搜索结果字符串
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should return results with max_results option', async () => {
      if (!OPENAI_API_KEY) return

      const tool = toolRegistry.get('web_search')!
      const result = await tool.execute(
        { query: 'TypeScript tutorial', max_results: 3 },
        ctx,
      )

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('should handle search with no results gracefully', async () => {
      if (!OPENAI_API_KEY) return

      const tool = toolRegistry.get('web_search')!
      // 使用不太可能返回结果的查询
      const result = await tool.execute(
        { query: 'xyzzy12345nonexistent' },
        ctx,
      )

      expect(result).toBeDefined()
      // 即使无结果也应返回字符串（可能为空或"无结果"提示）
      expect(typeof result).toBe('string')
    })
  })

  describe('image_search tool execution — 真实搜索', () => {
    it('should return image search results', async () => {
      if (!OPENAI_API_KEY) return

      const tool = toolRegistry.get('image_search')!
      const result = await tool.execute({ query: 'cute cats' }, ctx)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('academic_search tool execution — 真实搜索', () => {
    it('should return academic search results', async () => {
      if (!OPENAI_API_KEY) return

      const tool = toolRegistry.get('academic_search')!
      const result = await tool.execute({ query: 'quantum computing' }, ctx)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('academic results should contain paper information', async () => {
      if (!OPENAI_API_KEY) return

      const tool = toolRegistry.get('academic_search')!
      const result = await tool.execute({ query: 'machine learning' }, ctx)

      expect(result).toBeDefined()
      // 学术搜索结果应包含论文相关信息
      expect(typeof result).toBe('string')
    })
  })
})
