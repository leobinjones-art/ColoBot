/**
 * 服务启动核心逻辑
 */

import {
  initConfig,
  setGlobalAllowedTools,
  registerBuiltinTools,
  configureSearch,
  OpenAIProvider,
  AnthropicProvider,
  AgentRuntime,
  ToolRegistry,
  ToolExecutorImpl,
  InMemoryStore,
  DatabaseStore,
  NoOpScanner,
  ConsoleAudit,
  ConsolePusher,
  initDb,
  type LLMProvider,
  type RuntimeDeps,
  type MemoryStore,
} from '@colobot/core';

export interface DatabaseConfig {
  /** 数据库主机 */
  host?: string;
  /** 数据库端口 */
  port?: number;
  /** 数据库名 */
  database?: string;
  /** 用户名 */
  user?: string;
  /** 密码 */
  password?: string;
}

export interface ServerOptions {
  /** 配置文件路径 */
  configPath?: string;
  /** API Key */
  apiKey?: string;
  /** Provider: openai | anthropic */
  provider?: 'openai' | 'anthropic';
  /** 模型名称 */
  model?: string;
  /** 搜索引擎 */
  searchEngine?: 'duckduckgo' | 'google' | 'bing';
  /** 最大并发子 Agent 数 */
  maxConcurrent?: number;
  /** 允许的工具列表（逗号分隔） */
  allowedTools?: string;
  /** 存储类型：memory | database */
  storage?: 'memory' | 'database';
  /** 数据库配置（storage=database 时使用） */
  database?: DatabaseConfig;
  /** 是否启用 TUI */
  enableTUI?: boolean;
}

/**
 * 创建运行时
 */
export function createRuntime(options: ServerOptions = {}): {
  runtime: AgentRuntime;
  configManager: ReturnType<typeof initConfig>;
  llm: LLMProvider;
} {
  // 1. 初始化配置
  const configManager = initConfig(options.configPath);

  // 应用命令行选项
  if (options.provider) {
    configManager.setModelConfig({ provider: options.provider });
  }
  if (options.model) {
    configManager.setModelConfig({ model: options.model });
  }
  if (options.searchEngine) {
    configManager.setSearchConfig({ engine: options.searchEngine });
  }
  if (options.maxConcurrent) {
    configManager.setSubAgentConfig({ maxConcurrent: options.maxConcurrent });
  }
  if (options.allowedTools) {
    configManager.setSubAgentConfig({
      allowedTools: options.allowedTools.split(',').map(s => s.trim()),
    });
  }

  const config = configManager.getConfig();

  // 2. 应用配置到各模块
  setGlobalAllowedTools(config.subAgent.allowedTools);
  // 搜索引擎配置
  const searchEngineMap: Record<string, 'searxng' | 'duckduckgo' | 'google' | 'bing'> = {
    google: 'google',
    bing: 'bing',
    duckduckgo: 'duckduckgo',
    custom: 'searxng',
  };
  configureSearch({
    engine: searchEngineMap[config.search.engine] || 'duckduckgo',
    apiKey: config.search.apiKey,
    cx: config.search.cx,
    baseUrl: config.search.baseUrl,
    maxResults: config.search.maxResults,
    timeout: config.search.timeout,
  });

  // 3. 注册内置工具
  registerBuiltinTools();

  // 4. 获取 API Key（根据 provider 优先级）
  let apiKey: string;

  if (config.model.provider === 'anthropic') {
    // Anthropic 优先级：options > config > ANTHROPIC_API_KEY > OPENAI_API_KEY
    apiKey = options.apiKey ||
      config.model.apiKey ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      '';
  } else {
    // OpenAI 优先级：options > config > OPENAI_API_KEY > ANTHROPIC_API_KEY
    apiKey = options.apiKey ||
      config.model.apiKey ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      '';
  }

  if (!apiKey) {
    throw new Error('缺少 API Key。请设置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY 环境变量');
  }

  // 5. 创建 LLM Provider
  const llm = config.model.provider === 'openai'
    ? new OpenAIProvider({
        apiKey,
        defaultModel: config.model.model,
        baseUrl: config.model.baseUrl,
      })
    : new AnthropicProvider({
        apiKey,
        defaultModel: config.model.model,
      });

  // 6. 创建存储
  let memory: MemoryStore;

  if (options.storage === 'database') {
    // 数据库存储
    const dbConfig = options.database || {};
    memory = new DatabaseStore({
      host: dbConfig.host || process.env.DB_HOST,
      port: dbConfig.port || parseInt(process.env.DB_PORT || '5432'),
      database: dbConfig.database || process.env.DB_NAME,
      user: dbConfig.user || process.env.DB_USER,
      password: dbConfig.password || process.env.DB_PASSWORD,
    });
  } else {
    // 内存存储（默认）
    memory = new InMemoryStore();
  }

  // 7. 创建运行时
  const runtime = new AgentRuntime({
    llm,
    memory,
    tools: new ToolExecutorImpl(new ToolRegistry()),
    scanner: new NoOpScanner(),
    audit: new ConsoleAudit(),
    pusher: new ConsolePusher(),
  });

  return { runtime, configManager, llm };
}

/**
 * 启动 ColoBot 服务
 */
export async function startColoBot(options: ServerOptions = {}): Promise<void> {
  const { runtime, configManager } = createRuntime(options);
  const config = configManager.getConfig();
  const caps = configManager.getModelCapabilities();

  // 显示启动信息
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║             ColoBot Server Ready               ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
  console.log('Configuration:');
  console.log(`  Provider:     ${config.model.provider}`);
  console.log(`  Model:        ${config.model.model}`);
  console.log(`  Context:      ${caps.contextWindow.toLocaleString()} tokens`);
  console.log(`  Chunk Size:   ${(caps.recommendedChunkSize / 1000).toFixed(0)}KB`);
  console.log(`  Search:       ${config.search.engine}`);
  console.log(`  Max Agents:   ${config.subAgent.maxConcurrent}`);
  console.log(`  Tools:        ${config.subAgent.allowedTools.length} allowed`);
  console.log(`  Storage:      ${options.storage || 'memory'}`);
  console.log('');

  // 如果启用 TUI，启动 TUI 界面
  if (options.enableTUI) {
    const { TUI } = await import('@colobot/tui');
    const tui = new TUI();

    // 注册命令
    tui.commands.register('/exit', '退出程序', () => {
      console.log('\n再见！\n');
      process.exit(0);
    });

    tui.commands.register('/config', '显示配置', () => {
      console.log('\n当前配置:');
      console.log(`  Provider: ${config.model.provider}`);
      console.log(`  Model: ${config.model.model}`);
      console.log(`  Search: ${config.search.engine}`);
      console.log('');
    });

    await tui.start('ColoBot');
    console.log(`输入 /help 查看可用命令\n`);

    // 运行交互循环
    await tui.run(async (message) => {
      const result = await runtime.run({
        agentId: 'server-agent',
        sessionKey: 'server-session',
        userMessage: message,
      });

      if (typeof result.response === 'string') {
        return result.response;
      }
      return result.response.map(b => b.type === 'text' ? b.text : `[${b.type}]`).join('');
    });
  }
}
