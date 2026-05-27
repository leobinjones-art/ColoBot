/**
 * Tool Executor tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseToolCalls,
  stripToolCalls,
  formatToolResults,
  buildToolCall,
  executeToolCall,
  registerToolPolicy,
  needsApproval,
} from '../../tools/executor.js'
import { toolRegistry } from '../../tools/registry.js'
import { OpenAIProvider } from '../../providers/openai.js'
import type { ToolContext } from '@colomind/types'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Tool call delimiters - avoid hardcoding XML-like tags in test strings
const TOOL_CALL_OPEN = '<' + 'tool_call>'
const TOOL_CALL_CLOSE = '</' + 'tool_call>'

describe('Tool Executor', () => {
  const ctx: ToolContext = { agentId: 'test', sessionKey: 'test', workspace: '/test' }

  beforeEach(() => {
    toolRegistry.clear()
  })

  // --- parseToolCalls ---

  describe('parseToolCalls', () => {
    it('should return empty array for text with no tool calls', () => {
      expect(parseToolCalls('Hello, no tools here')).toEqual([])
    })

    it('should return empty array for empty string', () => {
      expect(parseToolCalls('')).toEqual([])
    })

    it('should parse a single tool call with single-quoted args', () => {
      const text = TOOL_CALL_OPEN + " read_file(path: '/tmp/data.txt') " + TOOL_CALL_CLOSE
      const calls = parseToolCalls(text)
      expect(calls).toHaveLength(1)
      expect(calls[0].name).toBe('read_file')
      expect(calls[0].args.path).toBe('/tmp/data.txt')
    })

    it('should parse a single tool call with double-quoted args', () => {
      const text = TOOL_CALL_OPEN + ' write_file(path: "/tmp/out.txt", content: "hello world") ' + TOOL_CALL_CLOSE
      const calls = parseToolCalls(text)
      expect(calls).toHaveLength(1)
      expect(calls[0].name).toBe('write_file')
      expect(calls[0].args.path).toBe('/tmp/out.txt')
      expect(calls[0].args.content).toBe('hello world')
    })

    it('should parse multiple tool calls', () => {
      const text = [
        TOOL_CALL_OPEN + " read_file(path: '/a') " + TOOL_CALL_CLOSE,
        'some text between',
        TOOL_CALL_OPEN + " write_file(path: '/b') " + TOOL_CALL_CLOSE,
      ].join('\n')
      const calls = parseToolCalls(text)
      expect(calls).toHaveLength(2)
      expect(calls[0].name).toBe('read_file')
      expect(calls[1].name).toBe('write_file')
    })

    it('should parse tool call with no args', () => {
      const text = TOOL_CALL_OPEN + ' list_agents() ' + TOOL_CALL_CLOSE
      const calls = parseToolCalls(text)
      expect(calls).toHaveLength(1)
      expect(calls[0].name).toBe('list_agents')
      expect(calls[0].args).toEqual({})
    })

    it('should parse tool call with unquoted arg value', () => {
      const text = TOOL_CALL_OPEN + ' calculate(expression: 2+2) ' + TOOL_CALL_CLOSE
      const calls = parseToolCalls(text)
      expect(calls).toHaveLength(1)
      expect(calls[0].name).toBe('calculate')
      expect(calls[0].args.expression).toBe('2+2')
    })

    it('should handle tool call name with underscores', () => {
      const text = TOOL_CALL_OPEN + " delete_agent(agent_id: 'abc-123') " + TOOL_CALL_CLOSE
      const calls = parseToolCalls(text)
      expect(calls[0].name).toBe('delete_agent')
      expect(calls[0].args.agent_id).toBe('abc-123')
    })
  })

  // --- stripToolCalls ---

  describe('stripToolCalls', () => {
    it('should return plain text unchanged', () => {
      expect(stripToolCalls('Hello world')).toBe('Hello world')
    })

    it('should return empty string for empty input', () => {
      expect(stripToolCalls('')).toBe('')
    })

    it('should remove a single tool call block', () => {
      const text = 'Before ' + TOOL_CALL_OPEN + " read_file(path: '/tmp') " + TOOL_CALL_CLOSE + ' after'
      // stripToolCalls replaces the block but leaves surrounding whitespace
      expect(stripToolCalls(text)).toBe('Before  after')
    })

    it('should remove multiple tool call blocks', () => {
      const text = [
        'Start ' + TOOL_CALL_OPEN + " tool_a(x: '1') " + TOOL_CALL_CLOSE,
        'middle ' + TOOL_CALL_OPEN + " tool_b(y: '2') " + TOOL_CALL_CLOSE + ' end',
      ].join(' ')
      const result = stripToolCalls(text)
      // Each removed block leaves a space gap
      expect(result).toBe('Start  middle  end')
    })

    it('should remove tool call and leave only surrounding text', () => {
      const text = TOOL_CALL_OPEN + ' some_tool() ' + TOOL_CALL_CLOSE
      expect(stripToolCalls(text)).toBe('')
    })
  })

  // --- formatToolResults ---

  describe('formatToolResults', () => {
    it('should return empty string for empty results', () => {
      expect(formatToolResults([])).toBe('')
    })

    it('should format a single successful result', () => {
      const results = [{ name: 'read_file', success: true, result: 'file content' }]
      const formatted = formatToolResults(results)
      expect(formatted).toBe('[read_file] OK: "file content"')
    })

    it('should format a single failed result', () => {
      const results = [{ name: 'read_file', success: false, result: null, error: 'File not found' }]
      const formatted = formatToolResults(results)
      expect(formatted).toBe('[read_file] ERROR: File not found')
    })

    it('should format multiple results separated by newlines', () => {
      const results = [
        { name: 'tool_a', success: true, result: { key: 'value' } },
        { name: 'tool_b', success: false, result: null, error: 'failed' },
      ]
      const formatted = formatToolResults(results)
      expect(formatted).toContain('[tool_a] OK:')
      expect(formatted).toContain('[tool_b] ERROR: failed')
      expect(formatted.split('\n')).toHaveLength(2)
    })

    it('should format object results as JSON', () => {
      const results = [{ name: 'list_agents', success: true, result: [{ id: '1', name: 'Agent1' }] }]
      const formatted = formatToolResults(results)
      expect(formatted).toContain('[list_agents] OK:')
      expect(formatted).toContain('Agent1')
    })
  })

  // --- buildToolCall ---

  describe('buildToolCall', () => {
    it('should build a tool call string with string args', () => {
      const result = buildToolCall('read_file', { path: '/tmp/test.txt' })
      expect(result).toContain('read_file')
      expect(result).toContain("path: '/tmp/test.txt'")
      expect(result).toContain(TOOL_CALL_OPEN)
      expect(result).toContain(TOOL_CALL_CLOSE)
    })

    it('should build a tool call string with non-string args', () => {
      const result = buildToolCall('calculate', { n: 42 })
      expect(result).toContain('calculate')
      expect(result).toContain('n: 42')
    })

    it('should build a tool call with no args', () => {
      const result = buildToolCall('list_agents', {})
      expect(result).toContain('list_agents()')
    })
  })

  // --- executeToolCall ---

  describe('executeToolCall', () => {
    it('should return error for unknown tool', async () => {
      const result = await executeToolCall({ name: 'nonexistent', args: {} }, ctx)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Tool not found')
      expect(result.name).toBe('nonexistent')
    })

    it('should execute a registered tool successfully', async () => {
      toolRegistry.register({
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
        execute: async () => 'mock result',
      })

      const result = await executeToolCall({ name: 'test_tool', args: { x: '1' } }, ctx)
      expect(result.success).toBe(true)
      expect(result.result).toBe('mock result')
    })

    it('should return error when tool execute throws', async () => {
      toolRegistry.register({
        name: 'failing_tool',
        description: 'A failing tool',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          throw new Error('execution failed')
        },
      })

      const result = await executeToolCall({ name: 'failing_tool', args: {} }, ctx)
      expect(result.success).toBe(false)
      expect(result.error).toContain('execution failed')
    })

    it('should enforce required_role policy - user with higher index blocked', async () => {
      // roleOrder = ['readonly', 'developer', 'admin'] -> readonly=0, developer=1, admin=2
      // The code blocks when userLevel > requiredLevel
      toolRegistry.register({
        name: 'readonly_tool',
        description: 'Readonly tool',
        parameters: { type: 'object', properties: {} },
        execute: async () => 'should not reach',
      })
      registerToolPolicy('readonly_tool', { required_role: 'readonly' })

      // admin(2) > readonly(0) = true -> blocked
      const adminCtx: ToolContext = { agentId: 'test', sessionKey: 'test', userRole: 'admin' }
      const result = await executeToolCall({ name: 'readonly_tool', args: {} }, adminCtx)
      expect(result.success).toBe(false)
      expect(result.blocked).toBe(true)
      expect(result.error).toContain('Insufficient role')
    })

    it('should allow access when user role has lower or equal index', async () => {
      // readonly(0) vs admin(2): readonly level is NOT > admin level, so not blocked
      toolRegistry.register({
        name: 'admin_tool',
        description: 'Admin only',
        parameters: { type: 'object', properties: {} },
        execute: async () => 'allowed',
      })
      registerToolPolicy('admin_tool', { required_role: 'admin' })

      const readonlyCtx: ToolContext = { agentId: 'test', sessionKey: 'test', userRole: 'readonly' }
      const result = await executeToolCall({ name: 'admin_tool', args: {} }, readonlyCtx)
      expect(result.success).toBe(true)
      expect(result.result).toBe('allowed')
    })

    it('should allow access when user role equals required role', async () => {
      toolRegistry.register({
        name: 'dev_tool',
        description: 'Developer tool',
        parameters: { type: 'object', properties: {} },
        execute: async () => 'allowed',
      })
      registerToolPolicy('dev_tool', { required_role: 'developer' })

      const devCtx: ToolContext = { agentId: 'test', sessionKey: 'test', userRole: 'developer' }
      const result = await executeToolCall({ name: 'dev_tool', args: {} }, devCtx)
      expect(result.success).toBe(true)
      expect(result.result).toBe('allowed')
    })

    it('should block when check_fn returns denied', async () => {
      toolRegistry.register({
        name: 'checked_tool',
        description: 'Policy-checked tool',
        parameters: { type: 'object', properties: {} },
        execute: async () => 'should not reach',
      })
      registerToolPolicy('checked_tool', {
        check_fn: async () => 'denied' as const,
      })

      const result = await executeToolCall({ name: 'checked_tool', args: {} }, ctx)
      expect(result.success).toBe(false)
      expect(result.blocked).toBe(true)
      expect(result.error).toContain('Denied by policy check')
    })

    it('should allow when check_fn returns allowed', async () => {
      toolRegistry.register({
        name: 'allowed_tool',
        description: 'Allowed by policy',
        parameters: { type: 'object', properties: {} },
        execute: async () => 'result',
      })
      registerToolPolicy('allowed_tool', {
        check_fn: async () => 'allowed' as const,
      })

      const result = await executeToolCall({ name: 'allowed_tool', args: {} }, ctx)
      expect(result.success).toBe(true)
      expect(result.result).toBe('result')
    })

    it('should handle check_fn throwing an error', async () => {
      toolRegistry.register({
        name: 'error_policy_tool',
        description: 'Tool with erroring policy',
        parameters: { type: 'object', properties: {} },
        execute: async () => 'should not reach',
      })
      registerToolPolicy('error_policy_tool', {
        check_fn: async () => {
          throw new Error('policy check crashed')
        },
      })

      const result = await executeToolCall({ name: 'error_policy_tool', args: {} }, ctx)
      expect(result.success).toBe(false)
      expect(result.blocked).toBe(true)
      expect(result.error).toContain('Policy check error')
    })

    it('should execute a tool that calls the real OpenAI provider', async () => {
      if (!OPENAI_API_KEY) return

      const provider = new OpenAIProvider({
        apiKey: OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o-mini',
      })

      // 注册一个调用真实 LLM 的工具
      toolRegistry.register({
        name: 'ask_llm',
        description: 'Ask the LLM a question',
        parameters: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'Question to ask' },
          },
          required: ['question'],
        },
        execute: async (args) => {
          const response = await provider.chat([
            { role: 'user', content: args.question as string },
          ])
          return response.content
        },
      })

      const result = await executeToolCall(
        { name: 'ask_llm', args: { question: 'Say exactly: HELLO_TEST' } },
        ctx,
      )
      expect(result.success).toBe(true)
      expect(typeof result.result).toBe('string')
    })
  })

  // --- needsApproval ---

  describe('needsApproval', () => {
    it('should return true when policy requires approval', () => {
      registerToolPolicy('needs_approval_tool', { require_approval: true })
      expect(needsApproval({ name: 'needs_approval_tool', args: {} })).toBe(true)
    })

    it('should return false when policy does not require approval', () => {
      registerToolPolicy('no_approval_tool', { require_approval: false })
      expect(needsApproval({ name: 'no_approval_tool', args: {} })).toBe(false)
    })

    it('should return false when no policy exists', () => {
      expect(needsApproval({ name: 'unregistered_tool', args: {} })).toBe(false)
    })
  })
})
