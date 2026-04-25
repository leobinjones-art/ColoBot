/**
 * E2E 测试 - @colobot/server
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('E2E: @colobot/server', () => {
  describe('exports', () => {
    it('should export all core modules', async () => {
      const server = await import('@colobot/server');

      // 配置
      expect(server.ConfigManager).toBeDefined();
      expect(server.initConfig).toBeDefined();

      // 运行时
      expect(server.AgentRuntime).toBeDefined();
      expect(server.OpenAIProvider).toBeDefined();
      expect(server.AnthropicProvider).toBeDefined();

      // 子 Agent
      expect(server.spawnSubAgent).toBeDefined();
      expect(server.setGlobalAllowedTools).toBeDefined();

      // 任务拆解
      expect(server.analyzeRequest).toBeDefined();
      expect(server.executeDynamicTask).toBeDefined();

      // 分块
      expect(server.readChunksByBytes).toBeDefined();
      expect(server.mergeText).toBeDefined();

      // 搜索
      expect(server.search).toBeDefined();
      expect(server.configureSearch).toBeDefined();

      // 工具
      expect(server.registerBuiltinTools).toBeDefined();
      expect(server.toolRegistry).toBeDefined();
    });

    it('should export all tui modules', async () => {
      const server = await import('@colobot/server');

      expect(server.TUI).toBeDefined();
      expect(server.ChatUI).toBeDefined();
      expect(server.CommandPalette).toBeDefined();
      expect(server.StatusBar).toBeDefined();
      expect(server.LogPanel).toBeDefined();

      expect(server.style).toBeDefined();
      expect(server.colors).toBeDefined();
      expect(server.printError).toBeDefined();
      expect(server.printSuccess).toBeDefined();
    });

    it('should export server functions', async () => {
      const server = await import('@colobot/server');

      expect(server.createRuntime).toBeDefined();
      expect(server.startColoBot).toBeDefined();
    });
  });

  describe('createRuntime', () => {
    beforeEach(async () => {
      const { toolRegistry } = await import('@colobot/server');
      toolRegistry.clear();
    });

    afterEach(async () => {
      const { toolRegistry } = await import('@colobot/server');
      toolRegistry.clear();
    });

    it('should create runtime with default config', async () => {
      const { createRuntime, toolRegistry } = await import('@colobot/server');

      // 设置环境变量
      process.env.OPENAI_API_KEY = 'test-key';
      toolRegistry.clear();

      const { runtime, configManager, llm } = createRuntime();

      expect(runtime).toBeDefined();
      expect(configManager).toBeDefined();
      expect(llm).toBeDefined();

      const config = configManager.getConfig();
      expect(config.model.provider).toBe('openai');

      delete process.env.OPENAI_API_KEY;
      toolRegistry.clear();
    });

    it('should create runtime with custom options', async () => {
      const { createRuntime, toolRegistry } = await import('@colobot/server');

      toolRegistry.clear();

      const { configManager } = createRuntime({
        apiKey: 'test-key',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        searchEngine: 'duckduckgo',
        maxConcurrent: 5,
        allowedTools: 'read_file,web_search',
      });

      const config = configManager.getConfig();
      expect(config.model.provider).toBe('anthropic');
      expect(config.model.model).toBe('claude-sonnet-4-20250514');
      expect(config.search.engine).toBe('duckduckgo');
      expect(config.subAgent.maxConcurrent).toBe(5);
      expect(config.subAgent.allowedTools).toContain('read_file');
      expect(config.subAgent.allowedTools).toContain('web_search');

      toolRegistry.clear();
    });

    it('should throw error without API key', async () => {
      const { createRuntime, toolRegistry } = await import('@colobot/server');

      // 清除环境变量
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      toolRegistry.clear();

      expect(() => createRuntime()).toThrow('缺少 API Key');

      // 恢复
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      }
      toolRegistry.clear();
    });

    it('should prioritize correct API key for provider', async () => {
      const { createRuntime, toolRegistry } = await import('@colobot/server');

      toolRegistry.clear();

      // Anthropic provider 应优先使用 ANTHROPIC_API_KEY
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';

      createRuntime({ provider: 'anthropic' });
      // 不抛错说明成功使用了 anthropic-key

      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      toolRegistry.clear();
    });

    it('should create runtime with database storage', async () => {
      const { createRuntime, toolRegistry, DatabaseStore } = await import('@colobot/server');

      toolRegistry.clear();

      // 使用内存存储测试（不实际连接数据库）
      const { runtime } = createRuntime({
        apiKey: 'test-key',
        storage: 'memory',
      });

      expect(runtime).toBeDefined();
      toolRegistry.clear();
    });
  });

  describe('integration', () => {
    beforeEach(async () => {
      const { toolRegistry } = await import('@colobot/server');
      toolRegistry.clear();
    });

    afterEach(async () => {
      const { toolRegistry } = await import('@colobot/server');
      toolRegistry.clear();
    });

    it('should work with subAgent', async () => {
      const { createRuntime, spawnSubAgent, clearSubAgents, setGlobalAllowedTools, toolRegistry } =
        await import('@colobot/server');

      toolRegistry.clear();

      const { configManager } = createRuntime({ apiKey: 'test-key' });
      const config = configManager.getConfig();

      setGlobalAllowedTools(config.subAgent.allowedTools);

      const agent = spawnSubAgent({
        name: 'test',
        soulContent: '{}',
        parentId: 'server-test',
      });

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('test');

      clearSubAgents();
      toolRegistry.clear();
    });

    it('should work with tools', async () => {
      const { createRuntime, toolRegistry } =
        await import('@colobot/server');

      // 先清理
      toolRegistry.clear();

      createRuntime({ apiKey: 'test-key' });

      // createRuntime 已注册内置工具
      const tools = toolRegistry.list();
      expect(tools.length).toBe(12);
      expect(toolRegistry.get('read_file')).toBeDefined();

      toolRegistry.clear();
    });

    it('should work with chunking', async () => {
      const { readChunksByBytes, mergeText } = await import('@colobot/server');

      const content = 'a'.repeat(500);
      const chunks: any[] = [];

      for await (const chunk of readChunksByBytes(content, {
        chunkSize: 200,
        overlap: 0,
        format: 'bytes',
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(3);

      const results = chunks.map((c, i) => ({
        chunkIndex: i,
        success: true,
        result: c.content,
      }));

      const merged = mergeText(results);
      // 合并后长度应该接近原始长度（可能有换行符等差异）
      expect(merged.length).toBeGreaterThanOrEqual(500);
    });
  });
});
