/**
 * @colobot/core 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Plugin, RuntimeTool } from '../plugins/types.js';
import { createPluginManager } from '../plugins/manager.js';
import { ToolRegistry } from '../tools/registry.js';
import { AgentRuntime } from '../runtime/index.js';

describe('@colobot/core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PluginManager', () => {
    it('should create plugin manager', () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const manager = createPluginManager(logger);
      expect(manager).toBeDefined();
      expect(manager.list()).toHaveLength(0);
    });

    it('should register plugin', async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const manager = createPluginManager(logger);

      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
      };

      await manager.register(plugin);
      expect(manager.list()).toHaveLength(1);
      expect(manager.get('test-plugin')).toBeDefined();
    });

    it('should register plugin with tools', async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const manager = createPluginManager(logger);

      const tool: RuntimeTool = {
        name: 'test-tool',
        description: 'Test tool',
        parameters: { type: 'object' },
        execute: async () => 'result',
      };

      const plugin: Plugin = {
        name: 'tool-plugin',
        version: '1.0.0',
        tools: [tool],
      };

      await manager.register(plugin);
      expect(manager.getTools()).toHaveLength(1);
      expect(manager.getTools()[0].name).toBe('test-tool');
    });

    it('should unregister plugin', async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const manager = createPluginManager(logger);

      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      await manager.register(plugin);
      await manager.unregister('test-plugin');
      expect(manager.list()).toHaveLength(0);
    });

    it('should throw on duplicate registration', async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const manager = createPluginManager(logger);

      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      await manager.register(plugin);

      await expect(manager.register(plugin)).rejects.toThrow('already registered');
    });
  });

  describe('ToolRegistry', () => {
    it('should register tool', () => {
      const registry = new ToolRegistry();

      const tool = {
        name: 'echo',
        description: 'Echo tool',
        parameters: { type: 'object' },
        execute: async () => 'echo',
      };

      registry.register(tool);
      expect(registry.get('echo')).toBeDefined();
      expect(registry.list()).toHaveLength(1);
    });

    it('should throw on duplicate tool', () => {
      const registry = new ToolRegistry();

      const tool = {
        name: 'echo',
        description: 'Echo tool',
        parameters: { type: 'object' },
        execute: async () => 'echo',
      };

      registry.register(tool);

      expect(() => registry.register(tool)).toThrow('already registered');
    });

    it('should get OpenAI format tools', () => {
      const registry = new ToolRegistry();

      registry.register({
        name: 'test',
        description: 'Test',
        parameters: { type: 'object', properties: { input: { type: 'string' } } },
        execute: async () => '',
      });

      const openaiTools = registry.getOpenAITools();
      expect(openaiTools).toHaveLength(1);
      expect(openaiTools[0].type).toBe('function');
      expect(openaiTools[0].function.name).toBe('test');
    });

    it('should execute tool', async () => {
      const registry = new ToolRegistry();

      registry.register({
        name: 'echo',
        description: 'Echo',
        parameters: { type: 'object' },
        execute: async (args) => `echo: ${args.message}`,
      });

      const result = await registry.execute('echo', { message: 'hello' }, { agentId: 'a1', sessionKey: 's1' });
      expect(result).toBe('echo: hello');
    });
  });

  describe('AgentRuntime', () => {
    it('should create runtime with deps', () => {
      const deps = {
        llm: {
          name: 'test',
          chat: vi.fn(async () => ({ content: 'response' })),
          chatStream: vi.fn(),
        },
        memory: {
          append: vi.fn(async () => {}),
          getHistory: vi.fn(async () => []),
          clear: vi.fn(async () => {}),
        },
        tools: {
          parse: vi.fn(() => []),
          execute: vi.fn(async () => []),
          format: vi.fn(() => ''),
        },
        scanner: {
          scanInput: vi.fn(async () => ({ safe: true })),
          scanOutput: vi.fn(async () => ({ safe: true })),
        },
        audit: {
          write: vi.fn(async () => {}),
        },
        pusher: {
          pushResult: vi.fn(),
          pushChunk: vi.fn(),
          pushDone: vi.fn(),
        },
      };

      const runtime = new AgentRuntime(deps);
      expect(runtime).toBeDefined();
    });

    it('should run agent', async () => {
      const deps = {
        llm: {
          name: 'test',
          chat: vi.fn(async () => ({ content: 'Hello response' })),
          chatStream: vi.fn(),
        },
        memory: {
          append: vi.fn(async () => {}),
          getHistory: vi.fn(async () => []),
          clear: vi.fn(async () => {}),
        },
        tools: {
          parse: vi.fn(() => []),
          execute: vi.fn(async () => []),
          format: vi.fn(() => ''),
        },
        scanner: {
          scanInput: vi.fn(async () => ({ safe: true })),
          scanOutput: vi.fn(async () => ({ safe: true })),
        },
        audit: {
          write: vi.fn(async () => {}),
        },
        pusher: {
          pushResult: vi.fn(),
          pushChunk: vi.fn(),
          pushDone: vi.fn(),
        },
      };

      const runtime = new AgentRuntime(deps);

      const result = await runtime.run({
        agentId: 'agent-1',
        sessionKey: 'session-1',
        userMessage: 'Hello',
      });

      expect(result.response).toBe('Hello response');
      expect(result.toolCalls).toHaveLength(0);
      expect(result.finished).toBe(true);
    });

    it('should block unsafe input', async () => {
      const deps = {
        llm: {
          name: 'test',
          chat: vi.fn(async () => ({ content: 'response' })),
          chatStream: vi.fn(),
        },
        memory: {
          append: vi.fn(async () => {}),
          getHistory: vi.fn(async () => []),
          clear: vi.fn(async () => {}),
        },
        tools: {
          parse: vi.fn(() => []),
          execute: vi.fn(async () => []),
          format: vi.fn(() => ''),
        },
        scanner: {
          scanInput: vi.fn(async () => ({ safe: false, reason: 'blocked' })),
          scanOutput: vi.fn(async () => ({ safe: true })),
        },
        audit: {
          write: vi.fn(async () => {}),
        },
        pusher: {
          pushResult: vi.fn(),
          pushChunk: vi.fn(),
          pushDone: vi.fn(),
        },
      };

      const runtime = new AgentRuntime(deps);

      const result = await runtime.run({
        agentId: 'agent-1',
        sessionKey: 'session-1',
        userMessage: 'Bad message',
      });

      expect(result.response).toContain('blocked');
    });
  });

  describe('Providers', () => {
    it('should create OpenAI provider', async () => {
      const { OpenAIProvider } = await import('../providers/openai.js');

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        defaultModel: 'gpt-4o',
      });

      expect(provider.name).toBe('openai');
    });

    it('should create Anthropic provider', async () => {
      const { AnthropicProvider } = await import('../providers/anthropic.js');

      const provider = new AnthropicProvider({
        apiKey: 'test-key',
        defaultModel: 'claude-sonnet-4-20250514',
      });

      expect(provider.name).toBe('anthropic');
    });
  });

  describe('Adapters', () => {
    it('should create InMemoryStore', async () => {
      const { InMemoryStore } = await import('../adapters/memory.js');

      const store = new InMemoryStore();
      await store.append('agent-1', 'session-1', 'user', 'hello');

      const history = await store.getHistory('agent-1', 'session-1');
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('hello');
    });

    it('should create SimpleContentScanner', async () => {
      const { SimpleContentScanner } = await import('../adapters/scanner.js');

      const scanner = new SimpleContentScanner({
        blockedWords: ['bad', 'evil'],
      });

      const safeResult = await scanner.scanInput('hello world');
      expect(safeResult.safe).toBe(true);

      const unsafeResult = await scanner.scanInput('this is bad');
      expect(unsafeResult.safe).toBe(false);
    });

    it('should create InMemoryAudit', async () => {
      const { InMemoryAudit } = await import('../adapters/audit.js');

      const audit = new InMemoryAudit();
      await audit.write({
        actorType: 'user',
        actorId: 'user-1',
        action: 'test',
        targetType: 'session',
        targetId: 'session-1',
        result: 'success',
      });

      const entries = audit.getEntries();
      expect(entries).toHaveLength(1);
    });
  });
});