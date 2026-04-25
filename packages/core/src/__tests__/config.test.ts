/**
 * 配置管理测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ConfigManager,
  DEFAULT_CONFIG,
  parseCLIArgs,
  applyCLIOptions,
  getModelCapabilities,
  type CoreConfig,
  type ModelConfig,
  type SearchConfig,
  type SubAgentConfig,
} from '../config/index.js';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('ConfigManager', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have all required fields', () => {
      expect(DEFAULT_CONFIG.model).toBeDefined();
      expect(DEFAULT_CONFIG.search).toBeDefined();
      expect(DEFAULT_CONFIG.subAgent).toBeDefined();
      expect(DEFAULT_CONFIG.audit).toBeDefined();
      expect(DEFAULT_CONFIG.memory).toBeDefined();
    });

    it('should have sensible defaults', () => {
      expect(DEFAULT_CONFIG.model.provider).toBe('openai');
      expect(DEFAULT_CONFIG.search.engine).toBe('duckduckgo');
      expect(DEFAULT_CONFIG.subAgent.maxConcurrent).toBe(10);
    });
  });

  describe('getModelCapabilities', () => {
    it('should return capabilities for known models', () => {
      const caps = getModelCapabilities('gpt-4o');
      expect(caps.contextWindow).toBe(128000);
      expect(caps.recommendedChunkSize).toBe(100000);
    });

    it('should return capabilities for claude models', () => {
      const caps = getModelCapabilities('claude-sonnet-4-20250514');
      expect(caps.contextWindow).toBe(200000);
      expect(caps.recommendedChunkSize).toBe(150000);
    });

    it('should return default for unknown models', () => {
      const caps = getModelCapabilities('unknown-model');
      expect(caps.contextWindow).toBe(4000);
    });
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const manager = new ConfigManager();
      const config = manager.getConfig();

      expect(config.model).toBeDefined();
      expect(config.search).toBeDefined();
      expect(config.subAgent).toBeDefined();
    });
  });

  describe('getModelConfig', () => {
    it('should return model config', () => {
      const manager = new ConfigManager();
      const modelConfig = manager.getModelConfig();

      expect(modelConfig.provider).toBeDefined();
      expect(modelConfig.model).toBeDefined();
    });
  });

  describe('setModelConfig', () => {
    it('should update model config', () => {
      const manager = new ConfigManager();

      manager.setModelConfig({
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      });

      const config = manager.getModelConfig();
      expect(config.provider).toBe('anthropic');
      expect(config.model).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('setSearchConfig', () => {
    it('should update search config', () => {
      const manager = new ConfigManager();

      manager.setSearchConfig({
        engine: 'google',
        maxResults: 20,
      });

      const config = manager.getSearchConfig();
      expect(config.engine).toBe('google');
      expect(config.maxResults).toBe(20);
    });
  });

  describe('setSubAgentConfig', () => {
    it('should update subagent config', () => {
      const manager = new ConfigManager();

      manager.setSubAgentConfig({
        maxConcurrent: 5,
        defaultTtlMs: 60000,
      });

      const config = manager.getSubAgentConfig();
      expect(config.maxConcurrent).toBe(5);
      expect(config.defaultTtlMs).toBe(60000);
    });
  });

  describe('allowTool / blockTool', () => {
    it('should allow a tool', () => {
      const manager = new ConfigManager();

      manager.blockTool('test_tool');
      manager.allowTool('test_tool');

      const config = manager.getSubAgentConfig();
      expect(config.allowedTools).toContain('test_tool');
      expect(config.blockedTools).not.toContain('test_tool');
    });

    it('should block a tool', () => {
      const manager = new ConfigManager();

      manager.allowTool('dangerous_tool');
      manager.blockTool('dangerous_tool');

      const config = manager.getSubAgentConfig();
      expect(config.blockedTools).toContain('dangerous_tool');
      expect(config.allowedTools).not.toContain('dangerous_tool');
    });
  });

  describe('updateConfig', () => {
    it('should update nested config', () => {
      const manager = new ConfigManager();

      manager.setModelConfig({
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        temperature: 0.5,
      });

      const config = manager.getConfig();
      expect(config.model.temperature).toBe(0.5);
      expect(config.model.provider).toBe('anthropic');
    });
  });

  describe('getModelCapabilities', () => {
    it('should return capabilities based on model', () => {
      const manager = new ConfigManager();

      manager.setModelConfig({ model: 'gpt-4o' });
      const caps = manager.getModelCapabilities();

      expect(caps.contextWindow).toBe(128000);
      expect(caps.recommendedChunkSize).toBe(100000);
    });
  });

  describe('getRecommendedChunking', () => {
    it('should calculate chunking params from model', () => {
      const manager = new ConfigManager();

      manager.setModelConfig({ model: 'claude-sonnet-4-20250514' });
      const chunking = manager.getRecommendedChunking();

      expect(chunking.chunkSize).toBe(150000);
      expect(chunking.overlap).toBe(1500); // 1%
      expect(chunking.maxParallel).toBe(3);
    });
  });

  describe('resetConfig', () => {
    it('should reset to defaults', () => {
      const manager = new ConfigManager();

      manager.setModelConfig({ model: 'custom-model' });
      manager.resetConfig();

      const config = manager.getModelConfig();
      expect(config.model).toBe(DEFAULT_CONFIG.model.model);
    });
  });
});

describe('parseCLIArgs', () => {
  it('should parse provider option', () => {
    const options = parseCLIArgs(['-p', 'anthropic']);
    expect(options.provider).toBe('anthropic');
  });

  it('should parse model option', () => {
    const options = parseCLIArgs(['-m', 'gpt-4o']);
    expect(options.model).toBe('gpt-4o');
  });

  it('should parse api key option', () => {
    const options = parseCLIArgs(['-k', 'secret-key']);
    expect(options.apiKey).toBe('secret-key');
  });

  it('should parse search engine option', () => {
    const options = parseCLIArgs(['-s', 'google']);
    expect(options.searchEngine).toBe('google');
  });

  it('should parse max concurrent option', () => {
    const options = parseCLIArgs(['--max-concurrent', '5']);
    expect(options.maxConcurrent).toBe(5);
  });

  it('should parse allowed tools option', () => {
    const options = parseCLIArgs(['--allowed-tools', 'read,write,search']);
    expect(options.allowedTools).toBe('read,write,search');
  });

  it('should parse config path option', () => {
    const options = parseCLIArgs(['-c', '/path/to/config.json']);
    expect(options.config).toBe('/path/to/config.json');
  });

  it('should parse help option', () => {
    const options = parseCLIArgs(['-h']);
    expect(options.help).toBe(true);
  });

  it('should parse multiple options', () => {
    const options = parseCLIArgs([
      '-p', 'anthropic',
      '-m', 'claude-sonnet-4-20250514',
      '--max-concurrent', '3',
    ]);

    expect(options.provider).toBe('anthropic');
    expect(options.model).toBe('claude-sonnet-4-20250514');
    expect(options.maxConcurrent).toBe(3);
  });
});

describe('applyCLIOptions', () => {
  it('should apply provider option', () => {
    const manager = new ConfigManager();

    applyCLIOptions(manager, { provider: 'anthropic' });

    const config = manager.getModelConfig();
    expect(config.provider).toBe('anthropic');
  });

  it('should apply model option', () => {
    const manager = new ConfigManager();

    applyCLIOptions(manager, { model: 'gpt-4-turbo' });

    const config = manager.getModelConfig();
    expect(config.model).toBe('gpt-4-turbo');
  });

  it('should apply search engine option', () => {
    const manager = new ConfigManager();

    applyCLIOptions(manager, { searchEngine: 'bing' });

    const config = manager.getSearchConfig();
    expect(config.engine).toBe('bing');
  });

  it('should apply max concurrent option', () => {
    const manager = new ConfigManager();

    applyCLIOptions(manager, { maxConcurrent: 8 });

    const config = manager.getSubAgentConfig();
    expect(config.maxConcurrent).toBe(8);
  });

  it('should apply allowed tools option', () => {
    const manager = new ConfigManager();

    applyCLIOptions(manager, { allowedTools: 'read,write,search' });

    const config = manager.getSubAgentConfig();
    expect(config.allowedTools).toContain('read');
    expect(config.allowedTools).toContain('write');
    expect(config.allowedTools).toContain('search');
  });
});
