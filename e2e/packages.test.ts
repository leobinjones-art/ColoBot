/**
 * E2E 测试 - ColoBot 完整流程测试
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// ── Types 包测试 ──────────────────────────────────────────────

describe('E2E: @colobot/types', () => {
  it('should export all LLM types', async () => {
    // 类型通过 type 导出，验证模块可导入
    const types = await import('@colobot/types');
    expect(types).toBeDefined();
  });

  it('should export all Agent types', async () => {
    const types = await import('@colobot/types');
    expect(types).toBeDefined();
  });

  it('should export all Tool types', async () => {
    const types = await import('@colobot/types');
    expect(types).toBeDefined();
  });

  it('should export all Memory types', async () => {
    const types = await import('@colobot/types');
    expect(types).toBeDefined();
  });

  it('should export all SOP types', async () => {
    const types = await import('@colobot/types');
    expect(types).toBeDefined();
  });

  it('should export all Service types', async () => {
    // 类型通过 type 导出，运行时不存在
    // 这里验证模块可以正常导入
    const types = await import('@colobot/types');
    expect(types).toBeDefined();
  });

  it('should export all Channel types', async () => {
    // 类型通过 type 导出，运行时不存在
    const types = await import('@colobot/types');
    expect(types).toBeDefined();
  });

  it('should create valid type instances', async () => {
    const types = await import('@colobot/types');

    // 创建实例验证类型正确
    const textContent: types.TextContent = { type: 'text', text: 'hello' };
    expect(textContent.text).toBe('hello');

    const message: types.LLMMessage = { role: 'user', content: 'test' };
    expect(message.role).toBe('user');

    const toolCall: types.ToolCall = {
      id: 'tc1',
      name: 'test',
      args: {},
      type: 'function',
      function: { name: 'test', arguments: '{}' },
    };
    expect(toolCall.name).toBe('test');

    const toolContext: types.ToolContext = { agentId: 'a1', sessionKey: 's1' };
    expect(toolContext.agentId).toBe('a1');
  });
});

// ── Core 包测试 ──────────────────────────────────────────────

describe('E2E: @colobot/core', () => {
  describe('exports', () => {
    it('should export all modules', async () => {
      const core = await import('@colobot/core');

      // 配置
      expect(core.ConfigManager).toBeDefined();
      expect(core.initConfig).toBeDefined();
      expect(core.DEFAULT_CONFIG).toBeDefined();

      // 子Agent
      expect(core.spawnSubAgent).toBeDefined();
      expect(core.runSubAgentTask).toBeDefined();
      expect(core.setGlobalAllowedTools).toBeDefined();

      // 任务拆解
      expect(core.analyzeRequest).toBeDefined();
      expect(core.executeDynamicTask).toBeDefined();

      // 大文件
      expect(core.processChunksParallel).toBeDefined();
      expect(core.mergeText).toBeDefined();

      // 搜索
      expect(core.search).toBeDefined();
      expect(core.configureSearch).toBeDefined();

      // 工具
      expect(core.registerBuiltinTools).toBeDefined();
      expect(core.toolRegistry).toBeDefined();
    });

    it('should export providers', async () => {
      const core = await import('@colobot/core');

      expect(core.OpenAIProvider).toBeDefined();
      expect(core.AnthropicProvider).toBeDefined();
    });

    it('should export adapters', async () => {
      const core = await import('@colobot/core');

      expect(core.InMemoryStore).toBeDefined();
      expect(core.ConsoleAudit).toBeDefined();
      expect(core.ConsolePusher).toBeDefined();
    });
  });

  describe('ConfigManager', () => {
    it('should create and manage config', async () => {
      const { ConfigManager, DEFAULT_CONFIG } = await import('@colobot/core');

      const manager = new ConfigManager();

      const config = manager.getConfig();
      expect(config.model).toBeDefined();
      expect(config.search).toBeDefined();
      expect(config.subAgent).toBeDefined();

      // 默认值检查
      expect(DEFAULT_CONFIG.model.provider).toBe('openai');
      expect(DEFAULT_CONFIG.subAgent.maxConcurrent).toBe(10);
    });

    it('should get model capabilities', async () => {
      const { getModelCapabilities } = await import('@colobot/core');

      const caps = getModelCapabilities('gpt-4o');
      expect(caps.contextWindow).toBe(128000);
      expect(caps.recommendedChunkSize).toBe(100000);

      const caps2 = getModelCapabilities('claude-sonnet-4-20250514');
      expect(caps2.contextWindow).toBe(200000);
    });

    it('should set and get config', async () => {
      const { ConfigManager } = await import('@colobot/core');

      const manager = new ConfigManager();

      manager.setModelConfig({ provider: 'anthropic', model: 'claude-test' });
      const model = manager.getModelConfig();
      expect(model.provider).toBe('anthropic');
      expect(model.model).toBe('claude-test');

      manager.setSearchConfig({ engine: 'google' });
      const search = manager.getSearchConfig();
      expect(search.engine).toBe('google');
    });
  });

  describe('SubAgent', () => {
    it('should spawn and manage sub agents', async () => {
      const {
        spawnSubAgent,
        getSubAgent,
        listSubAgents,
        destroySubAgent,
        clearSubAgents,
        setGlobalAllowedTools,
      } = await import('@colobot/core');

      clearSubAgents();
      setGlobalAllowedTools(['read_file', 'write_file']);

      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: JSON.stringify({ role: 'test' }),
        parentId: 'parent-1',
      });

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('test-agent');
      expect(agent.allowedTools).toContain('read_file');

      const found = getSubAgent(agent.id);
      expect(found?.name).toBe('test-agent');

      const list = listSubAgents('parent-1');
      expect(list.length).toBe(1);

      destroySubAgent(agent.id, 'parent-1');
      const afterDestroy = getSubAgent(agent.id);
      expect(afterDestroy).toBeUndefined();

      clearSubAgents();
    });

    it('should check tool allowed', async () => {
      const {
        spawnSubAgent,
        isToolAllowed,
        clearSubAgents,
      } = await import('@colobot/core');

      clearSubAgents();

      const agent = spawnSubAgent({
        name: 'test',
        soulContent: '{}',
        parentId: 'p1',
        allowedTools: ['read_file'],
      });

      expect(isToolAllowed(agent.id, 'read_file')).toBe(true);
      expect(isToolAllowed(agent.id, 'delete_file')).toBe(false);

      clearSubAgents();
    });
  });

  describe('Chunking', () => {
    it('should chunk content', async () => {
      const { readChunksByBytes, DEFAULT_CHUNK_CONFIG } = await import('@colobot/core');

      const content = 'a'.repeat(1000);
      const chunks: any[] = [];

      for await (const chunk of readChunksByBytes(content, {
        chunkSize: 300,
        overlap: 50,
        format: 'bytes',
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].content.length).toBe(300);
    });

    it('should merge results', async () => {
      const { mergeText, mergeArray, mergeStats } = await import('@colobot/core');

      const results = [
        { chunkIndex: 0, success: true, result: 'part1' },
        { chunkIndex: 1, success: true, result: 'part2' },
      ];

      const merged = mergeText(results);
      expect(merged).toContain('part1');
      expect(merged).toContain('part2');

      const arrResults = [
        { chunkIndex: 0, success: true, result: [1, 2] },
        { chunkIndex: 1, success: true, result: [3, 4] },
      ];

      const mergedArr = mergeArray(arrResults);
      expect(mergedArr).toEqual([1, 2, 3, 4]);

      const stats = mergeStats(results);
      expect(stats.successChunks).toBe(2);
    });
  });

  describe('Tools', () => {
    it('should register builtin tools', async () => {
      const { toolRegistry, registerBuiltinTools } = await import('@colobot/core');

      toolRegistry.clear();
      registerBuiltinTools();

      const tools = toolRegistry.list();
      expect(tools.length).toBe(12);

      expect(toolRegistry.get('read_file')).toBeDefined();
      expect(toolRegistry.get('write_file')).toBeDefined();
      expect(toolRegistry.get('web_search')).toBeDefined();
      expect(toolRegistry.get('python')).toBeDefined();
      expect(toolRegistry.get('http')).toBeDefined();
      expect(toolRegistry.get('json_parse')).toBeDefined();
      expect(toolRegistry.get('csv_parse')).toBeDefined();
      expect(toolRegistry.get('calculate')).toBeDefined();

      toolRegistry.clear();
    });
  });
});

// ── TUI 包测试 ──────────────────────────────────────────────

describe('E2E: @colobot/tui', () => {
  describe('exports', () => {
    it('should export all components', async () => {
      const tui = await import('@colobot/tui');

      expect(tui.TUI).toBeDefined();
      expect(tui.ChatUI).toBeDefined();
      expect(tui.CommandPalette).toBeDefined();
      expect(tui.StatusBar).toBeDefined();
      expect(tui.LogPanel).toBeDefined();
    });

    it('should export render utilities', async () => {
      const tui = await import('@colobot/tui');

      expect(tui.style).toBeDefined();
      expect(tui.colors).toBeDefined();
      expect(tui.clear).toBeDefined();
      expect(tui.printTitle).toBeDefined();
      expect(tui.printTable).toBeDefined();
      expect(tui.progressBar).toBeDefined();
      expect(tui.printError).toBeDefined();
      expect(tui.printSuccess).toBeDefined();
      expect(tui.printWarning).toBeDefined();
    });

    it('should export input utilities', async () => {
      const tui = await import('@colobot/tui');

      expect(tui.createInput).toBeDefined();
      expect(tui.ask).toBeDefined();
      expect(tui.confirm).toBeDefined();
      expect(tui.select).toBeDefined();
    });
  });

  describe('TUI instance', () => {
    it('should create TUI with default commands', async () => {
      const { TUI } = await import('@colobot/tui');

      const tui = new TUI();

      expect(tui.chat).toBeDefined();
      expect(tui.commands).toBeDefined();
      expect(tui.status).toBeDefined();
      expect(tui.logs).toBeDefined();

      const commands = tui.commands.list();
      expect(commands).toContain('/help');
      expect(commands).toContain('/clear');
    });

    it('should register custom commands', async () => {
      const { TUI } = await import('@colobot/tui');

      const tui = new TUI();
      const handler = vi.fn();

      tui.commands.register('/custom', 'Custom command', handler);

      expect(tui.commands.list()).toContain('/custom');
      expect(tui.commands.execute('/custom')).toBe(true);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('ChatUI', () => {
    it('should add messages', async () => {
      const { ChatUI } = await import('@colobot/tui');

      const chat = new ChatUI('Test');

      // 不抛错即可
      chat.addMessage('user', 'Hello');
      chat.addMessage('assistant', 'Hi there');
      chat.addMessage('system', 'System message');

      expect(chat).toBeDefined();
    });
  });

  describe('LogPanel', () => {
    it('should add and retrieve logs', async () => {
      const { LogPanel } = await import('@colobot/tui');

      const logs = new LogPanel();

      logs.log('info', 'Info message');
      logs.log('warn', 'Warning message');
      logs.log('error', 'Error message');

      const allLogs = logs.getLogs();
      expect(allLogs.length).toBe(3);
      expect(allLogs[0].level).toBe('info');
      expect(allLogs[1].level).toBe('warn');
      expect(allLogs[2].level).toBe('error');
    });
  });

  describe('render utilities', () => {
    it('should style text', async () => {
      const { style, colors } = await import('@colobot/tui');

      const styled = style('test', 'red', 'bold');
      expect(styled).toContain('test');
      expect(styled).toContain(colors.red);
    });

    it('should create progress bar', async () => {
      const { progressBar } = await import('@colobot/tui');

      const bar = progressBar(50, 100);
      expect(bar).toContain('50%');

      const bar2 = progressBar(0, 100);
      expect(bar2).toContain('0%');

      const bar3 = progressBar(100, 100);
      expect(bar3).toContain('100%');
    });
  });
});

// ── 跨包集成测试 ──────────────────────────────────────────────

describe('E2E: Cross-package integration', () => {
  it('should use types in core', async () => {
    const core = await import('@colobot/core');
    const types = await import('@colobot/types');

    // 创建 ToolContext 使用 types
    const ctx: types.ToolContext = { agentId: 'test', sessionKey: 'test' };
    expect(ctx.agentId).toBe('test');

    // core 应该接受 types 定义
    const { spawnSubAgent, clearSubAgents } = core;
    clearSubAgents();

    const agent = spawnSubAgent({
      name: 'integration-test',
      soulContent: '{}',
      parentId: 'p1',
    });

    expect(agent.id).toBeDefined();
    clearSubAgents();
  });

  it('should use core in tui', async () => {
    const core = await import('@colobot/core');
    const tui = await import('@colobot/tui');

    // TUI 可以使用 core 的配置
    const { initConfig } = core;
    const config = initConfig();

    expect(config.getConfig().model).toBeDefined();

    // TUI 可以使用 core 的工具
    const { registerBuiltinTools, toolRegistry } = core;
    toolRegistry.clear();
    registerBuiltinTools();

    expect(toolRegistry.get('read_file')).toBeDefined();

    // TUI 组件可以创建
    const { TUI } = tui;
    const ui = new TUI();
    expect(ui.commands).toBeDefined();

    toolRegistry.clear();
  });

  it('should flow: config → subAgent → task', async () => {
    const {
      initConfig,
      setGlobalAllowedTools,
      spawnSubAgent,
      clearSubAgents,
    } = await import('@colobot/core');

    // 1. 配置
    const config = initConfig();
    const subAgentConfig = config.getSubAgentConfig();

    // 2. 设置白名单
    setGlobalAllowedTools(subAgentConfig.allowedTools);

    // 3. 创建子Agent
    const agent = spawnSubAgent({
      name: 'flow-test',
      soulContent: JSON.stringify({ role: 'test' }),
      parentId: 'flow-parent',
    });

    // 4. 验证工具白名单生效
    expect(agent.allowedTools).toEqual(subAgentConfig.allowedTools);

    clearSubAgents();
  });
});