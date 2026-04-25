/**
 * 配置管理 - 命令行配置系统
 *
 * 支持配置：
 * - 模型设置（provider, model, apiKey）
 * - 搜索链接（搜索引擎、API端点）
 * - 子Agent白名单（允许的工具）
 *
 * 注意：大文件处理参数根据模型自动计算，无需手动配置
 */

import * as fs from 'fs';
import * as path from 'path';

// ── 模型能力定义 ──────────────────────────────────────────────

export interface ModelCapabilities {
  contextWindow: number;    // 上下文窗口（tokens）
  maxOutput: number;        // 最大输出（tokens）
  recommendedChunkSize: number;  // 建议分块大小（bytes）
  recommendedParallel: number;   // 建议并行数
}

// 模型能力表
const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // OpenAI
  'gpt-4o': { contextWindow: 128000, maxOutput: 4096, recommendedChunkSize: 100000, recommendedParallel: 3 },
  'gpt-4o-mini': { contextWindow: 128000, maxOutput: 16384, recommendedChunkSize: 100000, recommendedParallel: 5 },
  'gpt-4-turbo': { contextWindow: 128000, maxOutput: 4096, recommendedChunkSize: 100000, recommendedParallel: 3 },
  'gpt-3.5-turbo': { contextWindow: 16385, maxOutput: 4096, recommendedChunkSize: 40000, recommendedParallel: 5 },

  // Anthropic
  'claude-opus-4-7': { contextWindow: 200000, maxOutput: 16000, recommendedChunkSize: 150000, recommendedParallel: 3 },
  'claude-sonnet-4-6': { contextWindow: 200000, maxOutput: 16000, recommendedChunkSize: 150000, recommendedParallel: 3 },
  'claude-sonnet-4-20250514': { contextWindow: 200000, maxOutput: 16000, recommendedChunkSize: 150000, recommendedParallel: 3 },
  'claude-haiku-4-5-20251001': { contextWindow: 200000, maxOutput: 8000, recommendedChunkSize: 150000, recommendedParallel: 5 },

  // 默认（未知模型）
  'default': { contextWindow: 4000, maxOutput: 2048, recommendedChunkSize: 20000, recommendedParallel: 5 },
};

/**
 * 获取模型能力
 */
export function getModelCapabilities(model: string): ModelCapabilities {
  // 精确匹配
  if (MODEL_CAPABILITIES[model]) {
    return MODEL_CAPABILITIES[model];
  }

  // 模糊匹配
  const lowerModel = model.toLowerCase();
  for (const [key, caps] of Object.entries(MODEL_CAPABILITIES)) {
    if (lowerModel.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerModel)) {
      return caps;
    }
  }

  return MODEL_CAPABILITIES.default;
}

// ── 配置类型定义 ──────────────────────────────────────────────

export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface SearchConfig {
  engine: 'google' | 'bing' | 'duckduckgo' | 'custom';
  apiKey?: string;
  cx?: string;  // Google custom search CX
  baseUrl?: string;
  maxResults?: number;
  timeout?: number;
}

export interface SubAgentConfig {
  maxConcurrent: number;
  defaultTtlMs: number;
  defaultTimeoutMs: number;
  allowedTools: string[];
  blockedTools: string[];
}

export interface CoreConfig {
  model: ModelConfig;
  search: SearchConfig;
  subAgent: SubAgentConfig;
  audit: {
    enabled: boolean;
    logPath?: string;
    level: 'debug' | 'info' | 'warn' | 'error';
  };
  memory: {
    type: 'inmemory' | 'file' | 'database';
    path?: string;
    maxEntries?: number;
  };
}

// ── 默认配置 ──────────────────────────────────────────────

export const DEFAULT_CONFIG: CoreConfig = {
  model: {
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.7,
  },
  search: {
    engine: 'duckduckgo',
    maxResults: 10,
    timeout: 30000,
  },
  subAgent: {
    maxConcurrent: 10,
    defaultTtlMs: 300000,      // 5分钟
    defaultTimeoutMs: 300000,  // 5分钟
    allowedTools: [
      'read_file',
      'write_file',
      'list_dir',
      'web_search',
      'python',
      'http',
    ],
    blockedTools: [
      'delete_file',
      'execute_shell',
      'system_access',
    ],
  },
  audit: {
    enabled: true,
    level: 'info',
  },
  memory: {
    type: 'inmemory',
    maxEntries: 10000,
  },
};

// ── 配置管理器 ──────────────────────────────────────────────

export class ConfigManager {
  private config: CoreConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.loadConfig();
  }

  private getDefaultConfigPath(): string {
    // 优先级：环境变量 > 用户目录 > 当前目录
    if (process.env.COLOBOT_CONFIG) {
      return process.env.COLOBOT_CONFIG;
    }

    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const userConfig = path.join(homeDir, '.colobot', 'config.json');
    if (fs.existsSync(userConfig)) {
      return userConfig;
    }

    return path.join(process.cwd(), 'colobot.config.json');
  }

  /**
   * 加载配置
   */
  private loadConfig(): CoreConfig {
    // 从环境变量读取
    const envConfig = this.loadFromEnv();

    // 从文件读取
    const fileConfig = this.loadFromFile();

    // 合并配置：环境变量 > 文件 > 默认
    return this.mergeConfigs(DEFAULT_CONFIG, fileConfig, envConfig);
  }

  /**
   * 从环境变量加载配置
   */
  private loadFromEnv(): Partial<CoreConfig> {
    const config: Partial<CoreConfig> = {};

    // 模型配置
    if (process.env.LLM_PROVIDER) {
      config.model = {
        provider: process.env.LLM_PROVIDER as 'openai' | 'anthropic',
        model: process.env.LLM_MODEL || '',
        apiKey: process.env.LLM_API_KEY,
        baseUrl: process.env.LLM_BASE_URL,
      };
    }

    // 搜索配置
    if (process.env.SEARCH_ENGINE) {
      config.search = {
        engine: process.env.SEARCH_ENGINE as SearchConfig['engine'],
        apiKey: process.env.SEARCH_API_KEY,
        cx: process.env.SEARCH_CX,
        baseUrl: process.env.SEARCH_BASE_URL,
      };
    }

    // 子Agent配置
    if (process.env.SUBAGENT_ALLOWED_TOOLS) {
      config.subAgent = {
        allowedTools: process.env.SUBAGENT_ALLOWED_TOOLS.split(',').map(s => s.trim()),
        blockedTools: [],
        maxConcurrent: parseInt(process.env.SUBAGENT_MAX_CONCURRENT || '10'),
        defaultTtlMs: parseInt(process.env.SUBAGENT_TTL_MS || '300000'),
        defaultTimeoutMs: parseInt(process.env.SUBAGENT_TIMEOUT_MS || '300000'),
      };
    }

    return config;
  }

  /**
   * 从文件加载配置
   */
  private loadFromFile(): Partial<CoreConfig> {
    if (!fs.existsSync(this.configPath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.warn(`Failed to load config from ${this.configPath}:`, e);
      return {};
    }
  }

  /**
   * 合并配置
   */
  private mergeConfigs(
    base: CoreConfig,
    ...overrides: Partial<CoreConfig>[]
  ): CoreConfig {
    let result = { ...base };

    for (const override of overrides) {
      result = this.deepMerge(result, override);
    }

    return result;
  }

  private deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== undefined) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof target[key] === 'object' &&
          target[key] !== null
        ) {
          result[key] = this.deepMerge(target[key], source[key] as Partial<T[Extract<keyof T, string>]>);
        } else {
          result[key] = source[key] as T[Extract<keyof T, string>];
        }
      }
    }

    return result;
  }

  /**
   * 获取完整配置
   */
  getConfig(): CoreConfig {
    return { ...this.config };
  }

  /**
   * 获取模型配置
   */
  getModelConfig(): ModelConfig {
    return { ...this.config.model };
  }

  /**
   * 获取搜索配置
   */
  getSearchConfig(): SearchConfig {
    return { ...this.config.search };
  }

  /**
   * 获取子Agent配置
   */
  getSubAgentConfig(): SubAgentConfig {
    return { ...this.config.subAgent };
  }

  /**
   * 获取模型能力（自动计算分块参数）
   */
  getModelCapabilities(): ModelCapabilities {
    return getModelCapabilities(this.config.model.model);
  }

  /**
   * 获取推荐分块配置（根据模型自动计算）
   */
  getRecommendedChunking() {
    const caps = this.getModelCapabilities();
    return {
      chunkSize: caps.recommendedChunkSize,
      overlap: Math.floor(caps.recommendedChunkSize * 0.01), // 1% 重叠
      maxParallel: caps.recommendedParallel,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<CoreConfig>): void {
    this.config = this.deepMerge(this.config, updates);
  }

  /**
   * 更新模型配置
   */
  setModelConfig(config: Partial<ModelConfig>): void {
    this.config.model = { ...this.config.model, ...config };
  }

  /**
   * 更新搜索配置
   */
  setSearchConfig(config: Partial<SearchConfig>): void {
    this.config.search = { ...this.config.search, ...config };
  }

  /**
   * 更新子Agent配置
   */
  setSubAgentConfig(config: Partial<SubAgentConfig>): void {
    this.config.subAgent = { ...this.config.subAgent, ...config };
  }

  /**
   * 添加允许的工具
   */
  allowTool(tool: string): void {
    if (!this.config.subAgent.allowedTools.includes(tool)) {
      this.config.subAgent.allowedTools.push(tool);
    }
    const blockedIndex = this.config.subAgent.blockedTools.indexOf(tool);
    if (blockedIndex >= 0) {
      this.config.subAgent.blockedTools.splice(blockedIndex, 1);
    }
  }

  /**
   * 禁止工具
   */
  blockTool(tool: string): void {
    if (!this.config.subAgent.blockedTools.includes(tool)) {
      this.config.subAgent.blockedTools.push(tool);
    }
    const allowedIndex = this.config.subAgent.allowedTools.indexOf(tool);
    if (allowedIndex >= 0) {
      this.config.subAgent.allowedTools.splice(allowedIndex, 1);
    }
  }

  /**
   * 保存配置到文件
   */
  saveConfig(path?: string): void {
    const savePath = path || this.configPath;
    const dir = path ? require('path').dirname(path) : require('path').dirname(this.configPath);

    // 确保目录存在
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(savePath, JSON.stringify(this.config, null, 2));
  }

  /**
   * 重置为默认配置
   */
  resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
  }
}

// ── 全局配置实例 ──────────────────────────────────────────────

let globalConfigManager: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager();
  }
  return globalConfigManager;
}

export function initConfig(configPath?: string): ConfigManager {
  globalConfigManager = new ConfigManager(configPath);
  return globalConfigManager;
}

// ── 命令行参数解析 ──────────────────────────────────────────────

export interface CLIOptions {
  config?: string;
  provider?: string;
  model?: string;
  apiKey?: string;
  searchEngine?: string;
  maxConcurrent?: number;
  allowedTools?: string;
  help?: boolean;
}

export function parseCLIArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-c':
      case '--config':
        options.config = args[++i];
        break;
      case '-p':
      case '--provider':
        options.provider = args[++i];
        break;
      case '-m':
      case '--model':
        options.model = args[++i];
        break;
      case '-k':
      case '--api-key':
        options.apiKey = args[++i];
        break;
      case '-s':
      case '--search':
        options.searchEngine = args[++i];
        break;
      case '--max-concurrent':
        options.maxConcurrent = parseInt(args[++i]);
        break;
      case '--allowed-tools':
        options.allowedTools = args[++i];
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
    }
  }

  return options;
}

export function applyCLIOptions(manager: ConfigManager, options: CLIOptions): void {
  if (options.provider || options.model || options.apiKey) {
    manager.setModelConfig({
      provider: options.provider as ModelConfig['provider'],
      model: options.model || '',
      apiKey: options.apiKey,
    });
  }

  if (options.searchEngine) {
    manager.setSearchConfig({
      engine: options.searchEngine as SearchConfig['engine'],
    });
  }

  if (options.maxConcurrent) {
    manager.setSubAgentConfig({
      maxConcurrent: options.maxConcurrent,
    });
  }

  if (options.allowedTools) {
    manager.setSubAgentConfig({
      allowedTools: options.allowedTools.split(',').map(s => s.trim()),
    });
  }
}

// ── 帮助信息 ──────────────────────────────────────────────

export const HELP_TEXT = `
ColoBot Core CLI

Usage: colobot-core [options]

Options:
  -c, --config <path>       配置文件路径
  -p, --provider <name>     LLM 提供商 (openai, anthropic)
  -m, --model <name>        模型名称
  -k, --api-key <key>       API 密钥
  -s, --search <engine>     搜索引擎 (google, bing, duckduckgo)
  --max-concurrent <n>      子Agent最大并发数
  --allowed-tools <tools>   允许的工具列表 (逗号分隔)
  -h, --help                显示帮助信息

环境变量:
  LLM_PROVIDER              LLM 提供商
  LLM_MODEL                 模型名称
  LLM_API_KEY               API 密钥
  LLM_BASE_URL              API 基础URL
  SEARCH_ENGINE             搜索引擎
  SEARCH_API_KEY            搜索API密钥
  SUBAGENT_ALLOWED_TOOLS    子Agent允许的工具
  SUBAGENT_MAX_CONCURRENT   子Agent最大并发数

配置文件位置 (优先级):
  1. COLOBOT_CONFIG 环境变量
  2. ~/.colobot/config.json
  3. ./colobot.config.json

示例:
  colobot-core -p anthropic -m claude-sonnet-4-20250514
  colobot-core --provider openai --model gpt-4o --max-concurrent 5
  colobot-core -c /path/to/config.json
`;
