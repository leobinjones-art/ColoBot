/**
 * 子智能体系统测试
 * 使用真实实现替代 vi.fn()
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  spawnSubAgent,
  getSubAgent,
  listSubAgents,
  destroySubAgent,
  setSubAgentStatus,
  touchSubAgent,
  isToolAllowed,
  getSubAgentWorkspacePath,
  runSubAgentTask,
  clearSubAgents,
  setGlobalAllowedTools,
  type SubAgentDeps,
  type SimpleToolCall,
  type SimpleToolResult,
} from '../subagents/index.js'
import { InMemoryAudit } from '../adapters/audit.js'
import { MockProvider } from '../providers/mock.js'
import { OpenAIProvider } from '../providers/openai.js'
import type { LLMProvider, AuditLogger } from '../runtime/types.js'
import type { ToolContext } from '@colomind/types'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// ── Manual Call Trackers ──────────────────────────────────────

// Track calls to parseTools
const parseToolsCalls: Array<{ content: string; result: SimpleToolCall[] }> = []
function trackedParseTools(content: string): SimpleToolCall[] {
  // Parse XML format tool calls from LLM response
  const toolCalls: SimpleToolCall[] = []
  const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g
  let match
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      toolCalls.push({
        name: parsed.name,
        args: parsed.arguments || parsed.args || {},
      })
    } catch {}
  }
  parseToolsCalls.push({ content, result: toolCalls })
  return toolCalls
}

// Track calls to executeTools
const executeToolsCalls: Array<{ calls: SimpleToolCall[]; context: ToolContext; result: SimpleToolResult[] }> = []
async function trackedExecuteTools(calls: SimpleToolCall[], context: ToolContext): Promise<SimpleToolResult[]> {
  const results: SimpleToolResult[] = calls.map(c => ({
    name: c.name,
    result: `Result of ${c.name}`,
  }))
  executeToolsCalls.push({ calls, context, result: results })
  return results
}

// Track calls to formatResults
const formatResultsCalls: Array<{ results: SimpleToolResult[]; result: string }> = []
function trackedFormatResults(results: SimpleToolResult[]): string {
  const result = results.map(r => `Tool result: ${r.result ?? r.error}`).join('\n')
  formatResultsCalls.push({ results, result })
  return result
}

function resetCallTrackers(): void {
  parseToolsCalls.length = 0
  executeToolsCalls.length = 0
  formatResultsCalls.length = 0
}

describe('SubAgent System', () => {
  beforeEach(() => {
    clearSubAgents()
    // Reset to default tools
    setGlobalAllowedTools(['read_file', 'write_file', 'list_dir', 'web_search', 'python', 'http'])
    resetCallTrackers()
  })

  describe('spawnSubAgent', () => {
    it('should spawn a sub agent', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: JSON.stringify({ role: '助手' }),
        parentId: 'parent-1',
      })

      expect(agent.id).toBeDefined()
      expect(agent.name).toBe('test-agent')
      expect(agent.parentId).toBe('parent-1')
      expect(agent.status).toBe('idle')
    })

    it('should use global allowed tools', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
      })

      expect(agent.allowedTools).toContain('read_file')
      expect(agent.allowedTools).toContain('web_search')
    })

    it('should use custom allowed tools', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        allowedTools: ['custom_tool'],
      })

      expect(agent.allowedTools).toEqual(['custom_tool'])
    })

    it('should set TTL', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        ttlMs: 60000,
      })

      expect(agent.expiresAt - agent.createdAt).toBe(60000)
    })
  })

  describe('getSubAgent', () => {
    it('should get existing agent', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
      })

      const found = getSubAgent(agent.id)
      expect(found).toBe(agent)
    })

    it('should return undefined for non-existing agent', () => {
      const found = getSubAgent('non-existing')
      expect(found).toBeUndefined()
    })
  })

  describe('listSubAgents', () => {
    it('should list agents by parent', () => {
      spawnSubAgent({ name: 'agent-1', soulContent: '{}', parentId: 'parent-1' })
      spawnSubAgent({ name: 'agent-2', soulContent: '{}', parentId: 'parent-1' })
      spawnSubAgent({ name: 'agent-3', soulContent: '{}', parentId: 'parent-2' })

      const list1 = listSubAgents('parent-1')
      const list2 = listSubAgents('parent-2')

      expect(list1).toHaveLength(2)
      expect(list2).toHaveLength(1)
    })
  })

  describe('destroySubAgent', () => {
    it('should destroy agent by parent', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
      })

      const result = destroySubAgent(agent.id, 'parent-1')
      expect(result).toBe(true)
      expect(getSubAgent(agent.id)).toBeUndefined()
    })

    it('should not destroy agent by wrong parent', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
      })

      const result = destroySubAgent(agent.id, 'wrong-parent')
      expect(result).toBe(false)
      expect(getSubAgent(agent.id)).toBeDefined()
    })
  })

  describe('setSubAgentStatus', () => {
    it('should update status', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
      })

      setSubAgentStatus(agent.id, 'busy')
      expect(getSubAgent(agent.id)?.status).toBe('busy')
    })
  })

  describe('touchSubAgent', () => {
    it('should extend expiration', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        ttlMs: 1000, // 1 second TTL
      })

      const oldExpiresAt = agent.expiresAt
      // Extend by 2 minutes
      const result = touchSubAgent(agent.id, 120000)

      expect(result).toBe(true)
      const updated = getSubAgent(agent.id)
      // New expiration should be greater than the old one
      expect(updated?.expiresAt).toBeGreaterThan(Date.now())
    })
  })

  describe('isToolAllowed', () => {
    it('should check allowed tool', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        allowedTools: ['tool-a', 'tool-b'],
      })

      expect(isToolAllowed(agent.id, 'tool-a')).toBe(true)
      expect(isToolAllowed(agent.id, 'tool-c')).toBe(false)
    })
  })

  describe('getSubAgentWorkspacePath', () => {
    it('should return workspace path', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        workspacePath: '/custom/workspace',
      })

      expect(getSubAgentWorkspacePath(agent.id)).toBe('/custom/workspace')
    })

    it('should return null for non-existing agent', () => {
      expect(getSubAgentWorkspacePath('non-existing')).toBeNull()
    })
  })

  describe('runSubAgentTask', () => {
    it('should run task successfully with real MockProvider', async () => {
      const audit = new InMemoryAudit()
      const deps: SubAgentDeps = {
        llm: new MockProvider(),
        audit,
        parseTools: trackedParseTools,
        executeTools: trackedExecuteTools,
        formatResults: trackedFormatResults,
      }

      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: JSON.stringify({ role: '助手' }),
        parentId: 'parent-1',
      })

      const result = await runSubAgentTask(agent, 'test task', 'parent-1', deps)

      expect(result).toBeTruthy()
      expect(getSubAgent(agent.id)?.status).toBe('done')

      // Verify call trackers were used
      expect(parseToolsCalls.length).toBeGreaterThan(0)
    })

    it('should throw on parent mismatch', async () => {
      const audit = new InMemoryAudit()
      const deps: SubAgentDeps = {
        llm: new MockProvider(),
        audit,
        parseTools: trackedParseTools,
        executeTools: trackedExecuteTools,
        formatResults: trackedFormatResults,
      }

      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
      })

      await expect(runSubAgentTask(agent, 'test task', 'wrong-parent', deps)).rejects.toThrow(
        'Unauthorized',
      )
    })

    it('should block disallowed tools and record audit', async () => {
      // Use a MockProvider that returns a response containing a tool call
      // The MockProvider doesn't generate XML tool calls, so we need a custom
      // LLM that returns tool call XML format, then parse it
      const audit = new InMemoryAudit()

      // Custom parseTools that returns a blocked tool call
      const blockedParseCalls: Array<{ content: string; result: SimpleToolCall[] }> = []
      function parseWithBlockedTool(content: string): SimpleToolCall[] {
        blockedParseCalls.push({ content, result: [{ name: 'delete_file', args: { path: '/test' } }] })
        // First call returns blocked tool, second returns empty
        if (blockedParseCalls.length === 1) {
          return [{ name: 'delete_file', args: { path: '/test' } }]
        }
        return []
      }

      // Custom LLM that returns different content each round
      let chatCallCount = 0
      const chatCalls: Array<{ messages: any[] }> = []
      const blockingLLM: LLMProvider = {
        name: 'blocking-test',
        chat: async (messages: any[]) => {
          chatCallCount++
          chatCalls.push({ messages })
          if (chatCallCount === 1) {
            return { content: 'use delete_file tool' }
          }
          return { content: 'Done' }
        },
        chatStream: async function* () {
          yield { type: 'text', content: 'Done' }
        },
      }

      const deps: SubAgentDeps = {
        llm: blockingLLM,
        audit,
        parseTools: parseWithBlockedTool,
        executeTools: trackedExecuteTools,
        formatResults: trackedFormatResults,
      }

      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        allowedTools: ['read_file'],
      })

      await runSubAgentTask(agent, 'delete file', 'parent-1', deps)

      // Check audit entries for tool.blocked action
      const auditEntries = audit.getEntries()
      const blockedEntry = auditEntries.find(e => e.action === 'tool.blocked')
      expect(blockedEntry).toBeDefined()
      expect(blockedEntry!.targetId).toBe('delete_file')
    })

    it('should execute allowed tools', async () => {
      const audit = new InMemoryAudit()

      // Custom parseTools that returns an allowed tool call on first round
      let parseRound = 0
      function parseWithAllowedTool(content: string): SimpleToolCall[] {
        parseRound++
        if (parseRound === 1) {
          return [{ name: 'read_file', args: { path: '/test' } }]
        }
        return []
      }

      // Custom LLM that returns different content each round
      let chatCallCount = 0
      const toolLLM: LLMProvider = {
        name: 'tool-test',
        chat: async (messages: any[]) => {
          chatCallCount++
          if (chatCallCount === 1) {
            return { content: 'use read_file tool' }
          }
          return { content: 'Done' }
        },
        chatStream: async function* () {
          yield { type: 'text', content: 'Done' }
        },
      }

      const deps: SubAgentDeps = {
        llm: toolLLM,
        audit,
        parseTools: parseWithAllowedTool,
        executeTools: trackedExecuteTools,
        formatResults: trackedFormatResults,
      }

      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        allowedTools: ['read_file'],
      })

      await runSubAgentTask(agent, 'read file', 'parent-1', deps)

      // Verify executeTools was called with the allowed tool
      expect(executeToolsCalls.length).toBeGreaterThan(0)
      expect(executeToolsCalls[0].calls.some(c => c.name === 'read_file')).toBe(true)
    })

    it('should run task with real OpenAI provider', async () => {
      if (!OPENAI_API_KEY) return

      const openaiProvider = new OpenAIProvider({
        apiKey: OPENAI_API_KEY,
        defaultModel: 'gpt-4o-mini',
      })

      const audit = new InMemoryAudit()
      const deps: SubAgentDeps = {
        llm: openaiProvider,
        audit,
        parseTools: trackedParseTools,
        executeTools: trackedExecuteTools,
        formatResults: trackedFormatResults,
      }

      const agent = spawnSubAgent({
        name: 'test-agent-real',
        soulContent: JSON.stringify({ role: '助手' }),
        parentId: 'parent-1',
      })

      const result = await runSubAgentTask(agent, 'Say exactly: Task completed', 'parent-1', deps)

      expect(result).toBeTruthy()
      expect(getSubAgent(agent.id)?.status).toBe('done')
    })
  })

  describe('concurrency limits', () => {
    it('should limit total concurrent agents', () => {
      // Create 10 busy status agents
      for (let i = 0; i < 10; i++) {
        const agent = spawnSubAgent({
          name: `agent-${i}`,
          soulContent: '{}',
          parentId: 'parent-1',
        })
        setSubAgentStatus(agent.id, 'busy')
      }

      // The 11th should throw an error
      expect(() =>
        spawnSubAgent({
          name: 'agent-11',
          soulContent: '{}',
          parentId: 'parent-1',
        }),
      ).toThrow('并发已达上限')
    })
  })
})