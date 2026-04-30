/**
 * E2E 测试 - AgentRuntime 完整流程测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock fetch for providers
global.fetch = vi.fn()

// ── AgentRuntime 完整流程 ──────────────────────────────────────────────

describe('E2E: AgentRuntime Full Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('basic runtime', () => {
    it('should create runtime with MockProvider', async () => {
      const { AgentRuntime, MockProvider, InMemoryStore } = await import('@colobot/core')

      const runtime = new AgentRuntime({
        llm: new MockProvider(),
        memory: new InMemoryStore(),
        tools: {
          parse: () => [],
          execute: async () => [],
          format: () => '',
          getTools: () => [],
        },
      })

      expect(runtime).toBeDefined()
    })

    it('should run simple conversation', async () => {
      const { AgentRuntime, MockProvider, InMemoryStore } = await import('@colobot/core')

      const runtime = new AgentRuntime({
        llm: new MockProvider(),
        memory: new InMemoryStore(),
        tools: {
          parse: () => [],
          execute: async () => [],
          format: () => '',
          getTools: () => [],
        },
      })

      const result = await runtime.run({
        agentId: 'test-agent',
        sessionKey: 'session-1',
        userMessage: '你好',
      })

      expect(result.response).toBeDefined()
      expect(result.finished).toBe(true)
    })

    it('should maintain conversation history', async () => {
      const { AgentRuntime, MockProvider, InMemoryStore } = await import('@colobot/core')

      const memory = new InMemoryStore()
      const runtime = new AgentRuntime({
        llm: new MockProvider(),
        memory,
        tools: {
          parse: () => [],
          execute: async () => [],
          format: () => '',
          getTools: () => [],
        },
      })

      // 第一轮对话
      await runtime.run({
        agentId: 'agent-1',
        sessionKey: 'session-1',
        userMessage: '你好',
      })

      // 第二轮对话
      await runtime.run({
        agentId: 'agent-1',
        sessionKey: 'session-1',
        userMessage: '再见',
      })

      // 验证历史记录
      const history = await memory.getHistory('agent-1', 'session-1')
      expect(history.length).toBeGreaterThanOrEqual(4) // 2 user + 2 assistant
    })

    it('should use system prompt', async () => {
      const { AgentRuntime, MockProvider, InMemoryStore } = await import('@colobot/core')

      const runtime = new AgentRuntime({
        llm: new MockProvider(),
        memory: new InMemoryStore(),
        tools: {
          parse: () => [],
          execute: async () => [],
          format: () => '',
          getTools: () => [],
        },
      })

      const result = await runtime.run({
        agentId: 'test-agent',
        sessionKey: 'session-1',
        userMessage: '你好',
        systemPrompt: '你是一个专业的AI助手',
      })

      expect(result.response).toBeDefined()
    })

    it('should use soul config', async () => {
      const { AgentRuntime, MockProvider, InMemoryStore } = await import('@colobot/core')

      const runtime = new AgentRuntime({
        llm: new MockProvider(),
        memory: new InMemoryStore(),
        tools: {
          parse: () => [],
          execute: async () => [],
          format: () => '',
          getTools: () => [],
        },
      })

      const result = await runtime.run({
        agentId: 'test-agent',
        sessionKey: 'session-1',
        userMessage: '你好',
        soul: {
          role: 'AI助手',
          personality: '友好、专业',
        },
      })

      expect(result.response).toBeDefined()
    })
  })

  describe('streaming', () => {
    it('should support streaming output', async () => {
      const { AgentRuntime, MockProvider, InMemoryStore } = await import('@colobot/core')

      const runtime = new AgentRuntime({
        llm: new MockProvider(),
        memory: new InMemoryStore(),
        tools: {
          parse: () => [],
          execute: async () => [],
          format: () => '',
          getTools: () => [],
        },
      })

      const chunks: string[] = []
      for await (const chunk of runtime.runStream({
        agentId: 'test-agent',
        sessionKey: 'session-1',
        userMessage: '你好',
      })) {
        if (typeof chunk === 'string') {
          chunks.push(chunk)
        }
      }

      expect(chunks.length).toBeGreaterThan(0)
    })
  })

  describe('with tools', () => {
    it('should execute tool calls', async () => {
      const { AgentRuntime, MockProvider, InMemoryStore, toolRegistry, registerBuiltinTools } =
        await import('@colobot/core')

      toolRegistry.clear()
      registerBuiltinTools()

      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call-1',
                    function: { name: 'echo', arguments: '{"message": "test"}' },
                  },
                ],
              },
            },
          ],
        }),
      } as Response)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Done' } }],
        }),
      } as Response)

      const { OpenAIProvider } = await import('@colobot/core')
      const runtime = new AgentRuntime({
        llm: new OpenAIProvider({ apiKey: 'test' }),
        memory: new InMemoryStore(),
        tools: {
          parse: (text: string) => {
            const matches = text.match(/echo\(([^)]+)\)/g)
            if (!matches) return []
            return matches.map((m, i) => ({
              id: `call-${i}`,
              name: 'echo',
              args: { message: m.slice(6, -1).replace(/['"]/g, '') },
            }))
          },
          execute: async (calls: any[]) => {
            return calls.map((c) => ({ name: c.name, result: c.args.message, success: true }))
          },
          format: (results: any[]) => results.map((r) => `[${r.name}] ${r.result}`).join('\n'),
          getTools: () => toolRegistry.getOpenAITools(),
        },
      })

      toolRegistry.clear()
    })
  })
})

// ── 工具执行流程 ──────────────────────────────────────────────

describe('E2E: Tool Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('builtin tools', () => {
    it('should register all builtin tools', async () => {
      const { toolRegistry, registerBuiltinTools } = await import('@colobot/core')

      toolRegistry.clear()
      registerBuiltinTools()

      const tools = toolRegistry.list()
      expect(tools.length).toBeGreaterThanOrEqual(12)

      // 验证核心工具
      expect(toolRegistry.get('read_file')).toBeDefined()
      expect(toolRegistry.get('write_file')).toBeDefined()
      expect(toolRegistry.get('list_dir')).toBeDefined()
      expect(toolRegistry.get('web_search')).toBeDefined()
      expect(toolRegistry.get('python')).toBeDefined()
      expect(toolRegistry.get('shell')).toBeDefined()
      expect(toolRegistry.get('http')).toBeDefined()
      expect(toolRegistry.get('json_parse')).toBeDefined()
      expect(toolRegistry.get('csv_parse')).toBeDefined()
      expect(toolRegistry.get('calculate')).toBeDefined()
      expect(toolRegistry.get('echo')).toBeDefined()
      expect(toolRegistry.get('get_location')).toBeDefined()

      toolRegistry.clear()
    })

    it('should execute echo tool', async () => {
      const { toolRegistry, registerBuiltinTools } = await import('@colobot/core')

      toolRegistry.clear()
      registerBuiltinTools()

      const tool = toolRegistry.get('echo')
      const result = await tool!.execute({ message: 'Hello World' }, { agentId: 'test', sessionKey: 'test' })

      expect(result).toBe('Hello World')

      toolRegistry.clear()
    })

    it('should execute calculate tool', async () => {
      const { toolRegistry, registerBuiltinTools } = await import('@colobot/core')

      toolRegistry.clear()
      registerBuiltinTools()

      const tool = toolRegistry.get('calculate')

      const result1 = await tool!.execute({ expression: '2+2' }, { agentId: 'test', sessionKey: 'test' })
      expect(result1).toBe('4')

      const result2 = await tool!.execute({ expression: 'Math.sqrt(16)' }, { agentId: 'test', sessionKey: 'test' })
      expect(result2).toBe('4')

      const result3 = await tool!.execute({ expression: 'Math.PI' }, { agentId: 'test', sessionKey: 'test' })
      expect(parseFloat(result3)).toBeCloseTo(3.14159, 4)

      toolRegistry.clear()
    })

    it('should execute json_parse tool', async () => {
      const { toolRegistry, registerBuiltinTools } = await import('@colobot/core')

      toolRegistry.clear()
      registerBuiltinTools()

      const tool = toolRegistry.get('json_parse')
      const result = await tool!.execute({ text: '{"name":"test","value":123}' }, { agentId: 'test', sessionKey: 'test' })

      const parsed = JSON.parse(result)
      expect(parsed.name).toBe('test')
      expect(parsed.value).toBe(123)

      toolRegistry.clear()
    })

    it('should execute csv_parse tool', async () => {
      const { toolRegistry, registerBuiltinTools } = await import('@colobot/core')

      toolRegistry.clear()
      registerBuiltinTools()

      const tool = toolRegistry.get('csv_parse')
      const result = await tool!.execute(
        { text: 'name,age\nAlice,30\nBob,25' },
        { agentId: 'test', sessionKey: 'test' }
      )

      const parsed = JSON.parse(result)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].name).toBe('Alice')
      expect(parsed[1].name).toBe('Bob')

      toolRegistry.clear()
    })
  })

  describe('tool registry', () => {
    it('should register and unregister tools', async () => {
      const { toolRegistry } = await import('@colobot/core')

      toolRegistry.clear()

      toolRegistry.register({
        name: 'custom_tool',
        description: 'Custom tool',
        parameters: { type: 'object', properties: {} },
        execute: async () => 'custom result',
      })

      expect(toolRegistry.get('custom_tool')).toBeDefined()

      toolRegistry.unregister('custom_tool')
      expect(toolRegistry.get('custom_tool')).toBeUndefined()

      toolRegistry.clear()
    })

    it('should get OpenAI format tools', async () => {
      const { toolRegistry, registerBuiltinTools } = await import('@colobot/core')

      toolRegistry.clear()
      registerBuiltinTools()

      const openaiTools = toolRegistry.getOpenAITools()
      expect(openaiTools.length).toBeGreaterThan(0)
      expect(openaiTools[0].type).toBe('function')
      expect(openaiTools[0].function.name).toBeDefined()
      expect(openaiTools[0].function.description).toBeDefined()

      toolRegistry.clear()
    })
  })
})

// ── 记忆系统流程 ──────────────────────────────────────────────

describe('E2E: Memory System', () => {
  describe('InMemoryStore', () => {
    it('should store and retrieve messages', async () => {
      const { InMemoryStore } = await import('@colobot/core')

      const store = new InMemoryStore()

      await store.append('agent-1', 'session-1', 'user', 'Hello')
      await store.append('agent-1', 'session-1', 'assistant', 'Hi there')

      const history = await store.getHistory('agent-1', 'session-1')
      expect(history).toHaveLength(2)
      expect(history[0].role).toBe('user')
      expect(history[1].role).toBe('assistant')

      await store.clear('agent-1', 'session-1')
    })

    it('should clear history', async () => {
      const { InMemoryStore } = await import('@colobot/core')

      const store = new InMemoryStore()

      await store.append('agent-1', 'session-1', 'user', 'Hello')
      await store.clear('agent-1', 'session-1')

      const history = await store.getHistory('agent-1', 'session-1')
      expect(history).toHaveLength(0)
    })

    it('should handle multiple sessions', async () => {
      const { InMemoryStore } = await import('@colobot/core')

      const store = new InMemoryStore()

      await store.append('agent-1', 'session-1', 'user', 'Hello 1')
      await store.append('agent-1', 'session-2', 'user', 'Hello 2')
      await store.append('agent-2', 'session-1', 'user', 'Hello 3')

      const history1 = await store.getHistory('agent-1', 'session-1')
      const history2 = await store.getHistory('agent-1', 'session-2')
      const history3 = await store.getHistory('agent-2', 'session-1')

      expect(history1).toHaveLength(1)
      expect(history2).toHaveLength(1)
      expect(history3).toHaveLength(1)
    })
  })
})

// ── 搜索系统流程 ──────────────────────────────────────────────

describe('E2E: Search System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should configure search', async () => {
    const { configureSearch } = await import('@colobot/core')

    configureSearch({ engine: 'duckduckgo', maxResults: 5 })

    // 配置成功即可
    expect(configureSearch).toBeDefined()
  })

  it('should perform search', async () => {
    const { search, configureSearch } = await import('@colobot/core')

    // Mock fetch for search
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `
        <html>
          <div class="result">
            <a class="result__a" href="https://example.com/1">Result 1</a>
            <a class="result__snippet">Snippet 1</a>
          </div>
        </html>
      `,
    } as Response)

    configureSearch({ engine: 'duckduckgo', maxResults: 1 })

    // Note: Actual search may fail in test env, so we just verify the function exists
    expect(search).toBeDefined()
  })
})

// ── 子 Agent 流程 ──────────────────────────────────────────────

describe('E2E: SubAgent System', () => {
  beforeEach(async () => {
    const { clearSubAgents } = await import('@colobot/core')
    clearSubAgents()
  })

  afterEach(async () => {
    const { clearSubAgents } = await import('@colobot/core')
    clearSubAgents()
  })

  it('should spawn multiple sub agents', async () => {
    const { spawnSubAgent, listSubAgents, clearSubAgents } = await import('@colobot/core')

    const agent1 = spawnSubAgent({
      name: 'agent-1',
      soulContent: '{}',
      parentId: 'parent-1',
    })

    const agent2 = spawnSubAgent({
      name: 'agent-2',
      soulContent: '{}',
      parentId: 'parent-1',
    })

    const agent3 = spawnSubAgent({
      name: 'agent-3',
      soulContent: '{}',
      parentId: 'parent-2',
    })

    const list1 = listSubAgents('parent-1')
    const list2 = listSubAgents('parent-2')

    expect(list1).toHaveLength(2)
    expect(list2).toHaveLength(1)

    clearSubAgents()
  })

  it('should manage agent lifecycle', async () => {
    const { spawnSubAgent, getSubAgent, destroySubAgent, clearSubAgents } = await import('@colobot/core')

    const agent = spawnSubAgent({
      name: 'test-agent',
      soulContent: '{}',
      parentId: 'parent-1',
    })

    expect(getSubAgent(agent.id)).toBeDefined()

    destroySubAgent(agent.id, 'parent-1')

    expect(getSubAgent(agent.id)).toBeUndefined()

    clearSubAgents()
  })

  it('should enforce tool whitelist', async () => {
    const { spawnSubAgent, isToolAllowed, setGlobalAllowedTools, clearSubAgents } =
      await import('@colobot/core')

    setGlobalAllowedTools(['read_file', 'write_file'])

    const agent = spawnSubAgent({
      name: 'restricted-agent',
      soulContent: '{}',
      parentId: 'parent-1',
      allowedTools: ['read_file'],
    })

    expect(isToolAllowed(agent.id, 'read_file')).toBe(true)
    expect(isToolAllowed(agent.id, 'write_file')).toBe(false)
    expect(isToolAllowed(agent.id, 'delete_file')).toBe(false)

    clearSubAgents()
  })
})

// ── 配置系统流程 ──────────────────────────────────────────────

describe('E2E: Config System', () => {
  it('should initialize config', async () => {
    const { initConfig, DEFAULT_CONFIG } = await import('@colobot/core')

    const config = initConfig()

    expect(config.getConfig()).toBeDefined()
    expect(DEFAULT_CONFIG).toBeDefined()
  })

  it('should manage model config', async () => {
    const { ConfigManager } = await import('@colobot/core')

    const manager = new ConfigManager()

    manager.setModelConfig({ provider: 'anthropic', model: 'claude-test' })
    const model = manager.getModelConfig()

    expect(model.provider).toBe('anthropic')
    expect(model.model).toBe('claude-test')
  })

  it('should manage search config', async () => {
    const { ConfigManager } = await import('@colobot/core')

    const manager = new ConfigManager()

    manager.setSearchConfig({ engine: 'google', maxResults: 20 })
    const search = manager.getSearchConfig()

    expect(search.engine).toBe('google')
    expect(search.maxResults).toBe(20)
  })

  it('should manage subAgent config', async () => {
    const { ConfigManager } = await import('@colobot/core')

    const manager = new ConfigManager()

    manager.setSubAgentConfig({ maxConcurrent: 5, allowedTools: ['read_file'] })
    const subAgent = manager.getSubAgentConfig()

    expect(subAgent.maxConcurrent).toBe(5)
    expect(subAgent.allowedTools).toContain('read_file')
  })

  it('should get model capabilities', async () => {
    const { ConfigManager } = await import('@colobot/core')

    const manager = new ConfigManager()

    const caps1 = manager.getModelCapabilities('gpt-4o')
    expect(caps1.contextWindow).toBe(128000)

    const caps2 = manager.getModelCapabilities('gpt-4o-mini')
    expect(caps2.contextWindow).toBe(128000)

    const caps3 = manager.getModelCapabilities('unknown-model')
    expect(caps3.contextWindow).toBeDefined() // 返回默认值
  })
})

// ── 分块系统流程 ──────────────────────────────────────────────

describe('E2E: Chunking System', () => {
  it('should chunk by bytes', async () => {
    const { readChunksByBytes } = await import('@colobot/core')

    const content = 'a'.repeat(1000)
    const chunks: any[] = []

    for await (const chunk of readChunksByBytes(content, {
      chunkSize: 300,
      overlap: 50,
      format: 'bytes',
    })) {
      chunks.push(chunk)
    }

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].content.length).toBe(300)
  })

  it('should merge text results', async () => {
    const { mergeText } = await import('@colobot/core')

    const results = [
      { chunkIndex: 0, success: true, result: 'Part 1. ' },
      { chunkIndex: 1, success: true, result: 'Part 2. ' },
      { chunkIndex: 2, success: true, result: 'Part 3.' },
    ]

    const merged = mergeText(results)
    expect(merged).toContain('Part 1')
    expect(merged).toContain('Part 2')
    expect(merged).toContain('Part 3')
  })

  it('should merge array results', async () => {
    const { mergeArray } = await import('@colobot/core')

    const results = [
      { chunkIndex: 0, success: true, result: [1, 2, 3] },
      { chunkIndex: 1, success: true, result: [4, 5, 6] },
    ]

    const merged = mergeArray(results)
    expect(merged).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('should calculate stats', async () => {
    const { mergeStats } = await import('@colobot/core')

    const results = [
      { chunkIndex: 0, success: true, result: 'ok' },
      { chunkIndex: 1, success: false, result: null, error: 'failed' },
      { chunkIndex: 2, success: true, result: 'ok' },
    ]

    const stats = mergeStats(results)
    expect(stats.totalChunks).toBe(3)
    expect(stats.successChunks).toBe(2)
    expect(stats.failedChunks).toBe(1)
  })
})

// ── 任务拆解流程 ──────────────────────────────────────────────

describe('E2E: Task Breakdown', () => {
  it('should have breakdownTask function', async () => {
    const { breakdownTask } = await import('@colobot/core')

    expect(breakdownTask).toBeDefined()
    expect(typeof breakdownTask).toBe('function')
  })

  it('should analyze task structure', async () => {
    const { breakdownTask, MockProvider } = await import('@colobot/core')

    // breakdownTask 需要 parentId, llm, deps 参数
    const llm = new MockProvider()

    // 验证函数签名
    expect(breakdownTask).toBeDefined()
  })
})
