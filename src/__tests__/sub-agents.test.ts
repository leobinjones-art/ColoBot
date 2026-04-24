/**
 * Sub-Agent 配置测试
 */

import { describe, it, expect, vi } from 'vitest'

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
}))

import {
  DEFAULT_SUB_AGENT_CONFIGS,
  getSubAgentConfig,
  getAllSubAgentConfigs,
  getSubAgentConfigAsync,
  getAllSubAgentConfigsAsync,
} from '../config/sub-agents.js'

describe('Sub-Agent Config', () => {
  describe('DEFAULT_SUB_AGENT_CONFIGS', () => {
    it('should have all agent types', () => {
      expect(DEFAULT_SUB_AGENT_CONFIGS.search).toBeDefined()
      expect(DEFAULT_SUB_AGENT_CONFIGS.analysis).toBeDefined()
      expect(DEFAULT_SUB_AGENT_CONFIGS.writing).toBeDefined()
      expect(DEFAULT_SUB_AGENT_CONFIGS.review).toBeDefined()
      expect(DEFAULT_SUB_AGENT_CONFIGS.general).toBeDefined()
    })

    it('should have required fields for each type', () => {
      const types = ['search', 'analysis', 'writing', 'review', 'general'] as const
      for (const type of types) {
        const config = DEFAULT_SUB_AGENT_CONFIGS[type]
        expect(config.personality).toBeDefined()
        expect(config.rules).toBeInstanceOf(Array)
        expect(config.skills).toBeInstanceOf(Array)
        expect(config.tools).toBeInstanceOf(Array)
        expect(config.rules.length).toBeGreaterThan(0)
        expect(config.tools.length).toBeGreaterThan(0)
      }
    })

    it('should have appropriate tools for each type', () => {
      expect(DEFAULT_SUB_AGENT_CONFIGS.search.tools).toContain('web_search')
      expect(DEFAULT_SUB_AGENT_CONFIGS.writing.tools).toContain('write_file')
      expect(DEFAULT_SUB_AGENT_CONFIGS.analysis.tools).toContain('read_file')
    })
  })

  describe('getSubAgentConfig', () => {
    it('should return default config when no env var', () => {
      const config = getSubAgentConfig('search')
      expect(config).toEqual(DEFAULT_SUB_AGENT_CONFIGS.search)
    })

    it('should parse env var JSON if set', () => {
      const customConfig = {
        personality: 'custom',
        rules: ['rule1'],
        skills: ['skill1'],
        tools: ['tool1'],
      }
      process.env.SUB_AGENT_CONFIG_SEARCH = JSON.stringify(customConfig)
      const config = getSubAgentConfig('search')
      expect(config).toEqual(customConfig)
      delete process.env.SUB_AGENT_CONFIG_SEARCH
    })

    it('should fallback to default on invalid JSON', () => {
      process.env.SUB_AGENT_CONFIG_SEARCH = 'invalid json'
      const config = getSubAgentConfig('search')
      expect(config).toEqual(DEFAULT_SUB_AGENT_CONFIGS.search)
      delete process.env.SUB_AGENT_CONFIG_SEARCH
    })
  })

  describe('getAllSubAgentConfigs', () => {
    it('should return all configs', () => {
      const configs = getAllSubAgentConfigs()
      expect(Object.keys(configs)).toHaveLength(5)
      expect(configs.search).toBeDefined()
      expect(configs.analysis).toBeDefined()
    })
  })

  describe('getSubAgentConfigAsync', () => {
    it('should return default config when DB empty', async () => {
      const config = await getSubAgentConfigAsync('search')
      expect(config).toEqual(DEFAULT_SUB_AGENT_CONFIGS.search)
    })
  })

  describe('getAllSubAgentConfigsAsync', () => {
    it('should return all configs with source info', async () => {
      const configs = await getAllSubAgentConfigsAsync()
      expect(configs.search).toBeDefined()
      expect(configs.search.config).toBeDefined()
      expect(['db', 'env', 'default']).toContain(configs.search.source)
    })
  })
})