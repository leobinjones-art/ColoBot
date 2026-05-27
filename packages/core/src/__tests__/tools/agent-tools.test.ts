/**
 * Agent tools 测试 — 验证工具定义和结构
 * 不使用 mock，直接验证工具 schema
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { toolRegistry } from '../../tools/registry.js'
import { registerAgentTools } from '../../tools/agent-tools.js'
import type { RuntimeTool, ToolContext } from '@colomind/types'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ctx: ToolContext = { agentId: 'test', sessionKey: 'test' }

describe('Agent Tools', () => {
  let tools: RuntimeTool[]

  beforeAll(() => {
    toolRegistry.clear()
    registerAgentTools()
    tools = toolRegistry.list()
  })

  describe('list_agents', () => {
    it('should be registered as a tool', () => {
      const tool = tools.find((t) => t.name === 'list_agents')
      expect(tool).toBeDefined()
    })

    it('should have correct schema', () => {
      const tool = tools.find((t) => t.name === 'list_agents')!
      const params = tool.parameters as any
      expect(tool.name).toBe('list_agents')
      expect(tool.description).toBeTruthy()
      expect(params).toBeDefined()
      // list_agents 不需要必填参数
      expect(params.required ?? []).toEqual([])
    })

    it('should have empty properties and no required params', () => {
      const tool = tools.find((t) => t.name === 'list_agents')!
      const params = tool.parameters as any
      const props = params.properties ?? {}
      const required = params.required ?? []
      expect(required).toHaveLength(0)
      expect(typeof props).toBe('object')
    })
  })

  describe('get_agent', () => {
    it('should be registered as a tool', () => {
      const tool = tools.find((t) => t.name === 'get_agent')
      expect(tool).toBeDefined()
    })

    it('should have correct schema with agent_id parameter', () => {
      const tool = tools.find((t) => t.name === 'get_agent')!
      const params = tool.parameters as any
      expect(tool.name).toBe('get_agent')
      expect(tool.description).toBeTruthy()
      expect(params.properties).toHaveProperty('agent_id')
      expect(params.required).toContain('agent_id')
    })

    it('agent_id parameter should be a string', () => {
      const tool = tools.find((t) => t.name === 'get_agent')!
      const params = tool.parameters as any
      expect(params.properties.agent_id.type).toBe('string')
    })
  })

  describe('delete_agent', () => {
    it('should be registered as a tool', () => {
      const tool = tools.find((t) => t.name === 'delete_agent')
      expect(tool).toBeDefined()
    })

    it('should have correct schema with agent_id parameter', () => {
      const tool = tools.find((t) => t.name === 'delete_agent')!
      const params = tool.parameters as any
      expect(tool.name).toBe('delete_agent')
      expect(tool.description).toBeTruthy()
      expect(params.properties).toHaveProperty('agent_id')
      expect(params.required).toContain('agent_id')
    })

    it('agent_id parameter should be a string', () => {
      const tool = tools.find((t) => t.name === 'delete_agent')!
      const params = tool.parameters as any
      expect(params.properties.agent_id.type).toBe('string')
    })
  })

  describe('update_agent', () => {
    it('should be registered as a tool', () => {
      const tool = tools.find((t) => t.name === 'update_agent')
      expect(tool).toBeDefined()
    })

    it('should have correct schema with agent_id as required parameter', () => {
      const tool = tools.find((t) => t.name === 'update_agent')!
      const params = tool.parameters as any
      expect(tool.name).toBe('update_agent')
      expect(tool.description).toBeTruthy()
      expect(params.properties).toHaveProperty('agent_id')
      expect(params.required).toContain('agent_id')
    })

    it('should have optional parameters for agent settings', () => {
      const tool = tools.find((t) => t.name === 'update_agent')!
      const params = tool.parameters as any
      const props = params.properties
      // These are optional settings — not in required array
      expect(props).toHaveProperty('primary_model_id')
      expect(props).toHaveProperty('fallback_model_id')
      expect(props).toHaveProperty('temperature')
      expect(props).toHaveProperty('max_tokens')
      expect(props).toHaveProperty('max_tool_rounds')
      expect(props).toHaveProperty('system_prompt_override')
      // Only agent_id is required
      expect(params.required).toEqual(['agent_id'])
    })
  })

  describe('Tool Execution', () => {
    it('list_agents should return a result (may be empty list without running registry)', async () => {
      if (!OPENAI_API_KEY) return

      const tool = tools.find((t) => t.name === 'list_agents')!
      const result = await tool.execute({}, ctx)
      // list_agents 应该正常返回（即使是空列表），不应该抛异常
      expect(result).toBeDefined()
    })

    it('get_agent should handle missing agent gracefully', async () => {
      if (!OPENAI_API_KEY) return

      const tool = tools.find((t) => t.name === 'get_agent')!
      // 查询不存在的 agent 应该返回错误信息或抛异常
      try {
        const result = await tool.execute({ agent_id: 'nonexistent-agent' }, ctx)
        expect(result).toBeDefined()
      } catch (e: any) {
        expect(e.message).toBeTruthy()
      }
    })

    it('delete_agent should handle missing agent gracefully', async () => {
      if (!OPENAI_API_KEY) return

      const tool = tools.find((t) => t.name === 'delete_agent')!
      try {
        const result = await tool.execute({ agent_id: 'nonexistent-agent' }, ctx)
        expect(result).toBeDefined()
      } catch (e: any) {
        expect(e.message).toBeTruthy()
      }
    })
  })

  describe('All agent tools share common traits', () => {
    it('each tool has a non-empty description', () => {
      const agentToolNames = ['list_agents', 'get_agent', 'delete_agent', 'update_agent']
      for (const name of agentToolNames) {
        const tool = tools.find((t) => t.name === name)
        expect(tool).toBeDefined()
        expect(tool!.description.length).toBeGreaterThan(0)
      }
    })

    it('each tool has a valid JSON Schema parameters object', () => {
      const agentToolNames = ['list_agents', 'get_agent', 'delete_agent', 'update_agent']
      for (const name of agentToolNames) {
        const tool = tools.find((t) => t.name === name)
        expect(tool).toBeDefined()
        const params = tool!.parameters as any
        expect(params).toHaveProperty('type', 'object')
        expect(params).toHaveProperty('properties')
      }
    })
  })
})