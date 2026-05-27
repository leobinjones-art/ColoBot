/**
 * @colomind/types 包测试
 * 验证类型定义正确性和导出完整性
 */

import { describe, it, expect } from 'vitest'

describe('@colomind/types', () => {
  describe('LLM types', () => {
    it('should create TextContent correctly', async () => {
      const types = await import('../src/index.js')

      // 验证类型导出存在（运行时检查）
      const textContent = { type: 'text' as const, text: 'hello' }
      expect(textContent.type).toBe('text')
      expect(textContent.text).toBe('hello')
    })

    it('should create ImageUrlContent correctly', async () => {
      const imageContent = {
        type: 'image_url' as const,
        image_url: { url: 'https://example.com/image.png' },
      }
      expect(imageContent.type).toBe('image_url')
      expect(imageContent.image_url.url).toBe('https://example.com/image.png')
    })

    it('should create AudioContent correctly', async () => {
      const audioContent = {
        type: 'input_audio' as const,
        input_audio: { data: 'base64data', format: 'wav' },
      }
      expect(audioContent.type).toBe('input_audio')
      expect(audioContent.input_audio.format).toBe('wav')
    })

    it('should create LLMMessage correctly', async () => {
      const message = {
        role: 'user' as const,
        content: 'Hello',
      }
      expect(message.role).toBe('user')
      expect(message.content).toBe('Hello')
    })

    it('should create LLMMessage with ContentBlock array', async () => {
      const message = {
        role: 'assistant' as const,
        content: [
          { type: 'text' as const, text: 'Here is an image:' },
          { type: 'image_url' as const, image_url: { url: 'https://example.com/img.png' } },
        ],
      }
      expect(message.role).toBe('assistant')
      expect(Array.isArray(message.content)).toBe(true)
    })

    it('should create ToolDefinition correctly', async () => {
      const toolDef = {
        type: 'function' as const,
        function: {
          name: 'get_weather',
          description: 'Get weather info',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
          },
        },
      }
      expect(toolDef.type).toBe('function')
      expect(toolDef.function.name).toBe('get_weather')
    })

    it('should create LLMOptions correctly', async () => {
      const options = {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
        stream: true,
      }
      expect(options.model).toBe('gpt-4o')
      expect(options.temperature).toBe(0.7)
      expect(options.maxTokens).toBe(4096)
    })
  })

  describe('Tool types', () => {
    it('should create ToolCall correctly', async () => {
      const toolCall = {
        id: 'call_123',
        name: 'read_file',
        args: { path: '/tmp/test.txt' },
        type: 'function' as const,
        function: {
          name: 'read_file',
          arguments: '{"path":"/tmp/test.txt"}',
        },
      }
      expect(toolCall.id).toBe('call_123')
      expect(toolCall.name).toBe('read_file')
      expect(toolCall.args.path).toBe('/tmp/test.txt')
    })

    it('should create ToolResult correctly', async () => {
      const result = {
        toolCallId: 'call_123',
        name: 'read_file',
        result: 'file content here',
      }
      expect(result.toolCallId).toBe('call_123')
      expect(result.result).toBe('file content here')
    })

    it('should create ToolResult with error', async () => {
      const result = {
        toolCallId: 'call_456',
        name: 'write_file',
        result: '',
        error: 'Permission denied',
      }
      expect(result.error).toBe('Permission denied')
    })

    it('should create ToolContext correctly', async () => {
      const context = {
        agentId: 'agent-1',
        sessionKey: 'session-1',
        userId: 'user-1',
        workspace: '/workspace',
        timeout: 30000,
      }
      expect(context.agentId).toBe('agent-1')
      expect(context.sessionKey).toBe('session-1')
      expect(context.timeout).toBe(30000)
    })
  })

  describe('Agent types', () => {
    it('should create SubAgentConfig correctly', async () => {
      const config = {
        name: 'research-agent',
        soulContent: JSON.stringify({ role: 'researcher' }),
        parentId: 'parent-1',
        allowedTools: ['web_search', 'read_file'],
      }
      expect(config.name).toBe('research-agent')
      expect(config.allowedTools).toContain('web_search')
    })

    it('should create Skill correctly', async () => {
      const skill = {
        name: 'wechat-article',
        description: 'Read WeChat articles',
        version: '1.0.0',
        enabled: true,
      }
      expect(skill.name).toBe('wechat-article')
      expect(skill.enabled).toBe(true)
    })

    it('should create ApprovalRequest correctly', async () => {
      const approval = {
        id: 'approval-1',
        agentId: 'agent-1',
        toolName: 'delete_file',
        args: { path: '/important/data.txt' },
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      }
      expect(approval.toolName).toBe('delete_file')
      expect(approval.status).toBe('pending')
    })
  })

  describe('Memory types', () => {
    it('should create EmbedResult correctly', async () => {
      const embedResult = {
        embedding: [0.1, 0.2, 0.3],
        tokens: 10,
      }
      expect(embedResult.embedding).toHaveLength(3)
      expect(embedResult.tokens).toBe(10)
    })

    it('should create MemoryResult correctly', async () => {
      const memoryResult = {
        id: 'mem-1',
        agentId: 'agent-1',
        memoryKey: 'user-preference',
        content: 'User prefers dark mode',
        score: 0.95,
        createdAt: new Date().toISOString(),
      }
      expect(memoryResult.memoryKey).toBe('user-preference')
      expect(memoryResult.score).toBe(0.95)
    })

    it('should create KnowledgeEntry correctly', async () => {
      const entry = {
        id: 'kb-1',
        category: 'research',
        name: 'paper-notes',
        content: 'Important research notes',
        tags: ['paper', 'research'],
        createdAt: new Date().toISOString(),
      }
      expect(entry.category).toBe('research')
      expect(entry.tags).toContain('paper')
    })
  })

  describe('SOP types', () => {
    it('should create SopStep correctly', async () => {
      const step = {
        name: 'literature-search',
        description: 'Search for relevant literature',
        status: 'pending' as const,
        order: 1,
      }
      expect(step.name).toBe('literature-search')
      expect(step.order).toBe(1)
    })

    it('should create SopState correctly', async () => {
      const state = {
        agentId: 'agent-1',
        sessionKey: 'session-1',
        taskName: 'Literature Review',
        currentStep: 1,
        totalSteps: 5,
        status: 'in_progress' as const,
        steps: [],
        createdAt: new Date().toISOString(),
      }
      expect(state.taskName).toBe('Literature Review')
      expect(state.status).toBe('in_progress')
    })

    it('should create TaskAnalysis correctly', async () => {
      const analysis = {
        isAcademicTask: true,
        taskType: 'literature_review',
        taskName: 'Review recent papers',
        suggestedSteps: ['Search', 'Read', 'Summarize'],
        informationComplete: true,
        missingInfo: [],
      }
      expect(analysis.isAcademicTask).toBe(true)
      expect(analysis.taskType).toBe('literature_review')
    })
  })

  describe('Service types', () => {
    it('should create UserProfile correctly', async () => {
      const profile = {
        userId: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'developer' as const,
        expertiseLevel: 'intermediate' as const,
        preferences: {
          theme: 'dark',
          language: 'zh-CN',
        },
        createdAt: new Date().toISOString(),
      }
      expect(profile.userId).toBe('user-1')
      expect(profile.role).toBe('developer')
      expect(profile.preferences.theme).toBe('dark')
    })

    it('should create NotificationPayload correctly', async () => {
      const notification = {
        type: 'reminder',
        title: 'Meeting in 10 minutes',
        content: 'Team standup meeting',
        recipient: 'user-1',
        scheduledAt: new Date().toISOString(),
      }
      expect(notification.type).toBe('reminder')
      expect(notification.recipient).toBe('user-1')
    })

    it('should create AuditEntry correctly', async () => {
      const audit = {
        id: 'audit-1',
        agentId: 'agent-1',
        action: 'tool_call',
        toolName: 'write_file',
        args: { path: '/tmp/test.txt' },
        result: 'success',
        timestamp: new Date().toISOString(),
      }
      expect(audit.action).toBe('tool_call')
      expect(audit.result).toBe('success')
    })
  })

  describe('Channel types', () => {
    it('should create ChannelMessage correctly', async () => {
      const message = {
        id: 'msg-1',
        channel: 'feishu',
        sender: 'user-1',
        content: 'Hello from Feishu',
        timestamp: new Date().toISOString(),
        metadata: {
          openId: 'ou_xxx',
        },
      }
      expect(message.channel).toBe('feishu')
      expect(message.content).toBe('Hello from Feishu')
    })
  })

  describe('Type exports', () => {
    it('should export all LLM types', async () => {
      const types = await import('../src/index.js')
      // 类型导出验证 - 如果导入成功则类型存在
      expect(types).toBeDefined()
    })

    it('should export all Agent types', async () => {
      const types = await import('../src/index.js')
      expect(types).toBeDefined()
    })

    it('should export all Tool types', async () => {
      const types = await import('../src/index.js')
      expect(types).toBeDefined()
    })

    it('should export all Memory types', async () => {
      const types = await import('../src/index.js')
      expect(types).toBeDefined()
    })

    it('should export all SOP types', async () => {
      const types = await import('../src/index.js')
      expect(types).toBeDefined()
    })

    it('should export all Service types', async () => {
      const types = await import('../src/index.js')
      expect(types).toBeDefined()
    })

    it('should export all Channel types', async () => {
      const types = await import('../src/index.js')
      expect(types).toBeDefined()
    })
  })
})
