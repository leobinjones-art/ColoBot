#!/usr/bin/env node
/**
 * CLI 入口 - 命令行部署
 */

import * as readline from 'readline';
import { AgentRuntime, ToolRegistry, registerBuiltinTools } from './index.js';
import { OpenAIProvider, AnthropicProvider } from './providers/index.js';
import { InMemoryStore } from './adapters/memory.js';
import { ToolExecutorImpl } from './adapters/tools.js';
import { NoOpScanner } from './adapters/scanner.js';
import { ConsoleAudit } from './adapters/audit.js';
import { ConsolePusher } from './adapters/pusher.js';
import {
  initConfig,
  parseCLIArgs,
  applyCLIOptions,
  HELP_TEXT,
  type CLIOptions,
} from './config/index.js';
import { setGlobalAllowedTools } from './subagents/index.js';
import { configureSearch } from './search.js';

/**
 * 启动 CLI
 */
async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  const options = parseCLIArgs(args);

  // 显示帮助
  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  // 初始化配置管理器
  const configManager = initConfig(options.config);
  applyCLIOptions(configManager, options);

  const config = configManager.getConfig();

  // 应用配置到各模块
  // 1. 子Agent白名单
  setGlobalAllowedTools(config.subAgent.allowedTools);

  // 2. 搜索配置
  configureSearch({
    engine: config.search.engine as 'searxng' | 'duckduckgo' | 'google' | 'bing',
    apiKey: config.search.apiKey,
    cx: config.search.cx,
    baseUrl: config.search.baseUrl,
    maxResults: config.search.maxResults,
    timeout: config.search.timeout,
  });

  // 获取 API Key
  const apiKey = config.model.apiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    '';

  if (!apiKey) {
    console.error('Error: No API key provided.');
    console.error('Set LLM_API_KEY or use --api-key option.');
    process.exit(1);
  }

  // 创建 LLM Provider
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

  // 创建工具注册表
  const toolRegistry = new ToolRegistry();
  registerBuiltinTools();

  // 创建运行时依赖
  const deps = {
    llm,
    memory: new InMemoryStore(),
    tools: new ToolExecutorImpl(toolRegistry),
    scanner: new NoOpScanner(),
    audit: new ConsoleAudit(),
    pusher: new ConsolePusher(),
  };

  // 创建运行时
  const runtime = new AgentRuntime(deps);

  // 显示启动信息
  console.log('╔══════════════════════════════════════╗');
  console.log('║       ColoBot Core CLI Ready         ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('Configuration:');
  console.log(`  Provider:    ${config.model.provider}`);
  console.log(`  Model:       ${config.model.model}`);
  console.log(`  Search:      ${config.search.engine}`);
  console.log(`  Max Agents:  ${config.subAgent.maxConcurrent}`);
  console.log(`  Allowed:     ${config.subAgent.allowedTools.slice(0, 3).join(', ')}...`);

  // 显示模型能力
  const caps = configManager.getModelCapabilities();
  console.log('');
  console.log('Model Capabilities:');
  console.log(`  Context:     ${caps.contextWindow.toLocaleString()} tokens`);
  console.log(`  Chunk Size:  ${(caps.recommendedChunkSize / 1000).toFixed(0)}KB`);
  console.log(`  Parallel:    ${caps.recommendedParallel}`);

  console.log('');
  console.log('Commands:');
  console.log('  /config  - Show current configuration');
  console.log('  /set     - Update configuration');
  console.log('  /tools   - List allowed tools');
  console.log('  /help    - Show available commands');
  console.log('  /exit    - Exit CLI');
  console.log('');
  console.log('Type your message and press Enter.');
  console.log('');

  // 交互循环
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const message = line.trim();

    if (!message) {
      rl.prompt();
      return;
    }

    // 处理命令
    if (message.startsWith('/')) {
      handleCommand(message, configManager, rl);
      return;
    }

    // 处理消息
    try {
      const result = await runtime.run({
        agentId: 'cli-agent',
        sessionKey: 'cli-session',
        userMessage: message,
      });

      console.log(`\n${result.response}\n`);
    } catch (error) {
      console.error('Error:', error);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);
  });
}

/**
 * 处理 CLI 命令
 */
function handleCommand(
  command: string,
  configManager: ReturnType<typeof initConfig>,
  rl: readline.Interface
): void {
  const parts = command.split(' ');
  const cmd = parts[0];

  switch (cmd) {
    case '/config':
      showConfig(configManager);
      break;

    case '/set':
      handleSetCommand(parts.slice(1), configManager);
      break;

    case '/tools':
      showTools(configManager);
      break;

    case '/help':
      showCommands();
      break;

    case '/exit':
    case '/quit':
      rl.close();
      return;

    default:
      console.log(`Unknown command: ${cmd}`);
      console.log('Type /help for available commands.');
  }

  rl.prompt();
}

/**
 * 显示当前配置
 */
function showConfig(configManager: ReturnType<typeof initConfig>): void {
  const config = configManager.getConfig();
  const caps = configManager.getModelCapabilities();

  console.log('\nCurrent Configuration:');
  console.log('─'.repeat(40));
  console.log('\n[Model]');
  console.log(`  Provider:    ${config.model.provider}`);
  console.log(`  Model:       ${config.model.model}`);
  console.log(`  Max Tokens:  ${config.model.maxTokens}`);
  console.log(`  Temperature: ${config.model.temperature}`);

  console.log('\n[Model Capabilities]');
  console.log(`  Context:     ${caps.contextWindow.toLocaleString()} tokens`);
  console.log(`  Max Output:  ${caps.maxOutput.toLocaleString()} tokens`);
  console.log(`  Chunk Size:  ${(caps.recommendedChunkSize / 1000).toFixed(0)}KB`);
  console.log(`  Parallel:    ${caps.recommendedParallel}`);

  console.log('\n[Search]');
  console.log(`  Engine:      ${config.search.engine}`);
  console.log(`  Max Results: ${config.search.maxResults}`);
  console.log(`  Timeout:     ${config.search.timeout}ms`);

  console.log('\n[SubAgent]');
  console.log(`  Max Concurrent: ${config.subAgent.maxConcurrent}`);
  console.log(`  Default TTL:    ${config.subAgent.defaultTtlMs}ms`);
  console.log(`  Allowed Tools:  ${config.subAgent.allowedTools.length}`);
  console.log(`  Blocked Tools:  ${config.subAgent.blockedTools.length}`);

  console.log('');
}

/**
 * 处理 /set 命令
 */
function handleSetCommand(
  args: string[],
  configManager: ReturnType<typeof initConfig>
): void {
  if (args.length < 2) {
    console.log('Usage: /set <key> <value>');
    console.log('');
    console.log('Keys:');
    console.log('  model.provider      - openai, anthropic');
    console.log('  model.model         - model name');
    console.log('  model.temperature   - 0.0 - 1.0');
    console.log('  search.engine       - google, bing, duckduckgo');
    console.log('  subagent.max        - max concurrent agents');
    console.log('');
    console.log('Note: Chunking params are auto-calculated based on model');
    console.log('');
    return;
  }

  const key = args[0];
  const value = args[1];

  try {
    switch (key) {
      case 'model.provider':
        configManager.setModelConfig({ provider: value as 'openai' | 'anthropic' });
        console.log(`Provider set to: ${value}`);
        break;

      case 'model.model':
        configManager.setModelConfig({ model: value });
        const caps = configManager.getModelCapabilities();
        console.log(`Model set to: ${value}`);
        console.log(`Auto chunk size: ${(caps.recommendedChunkSize / 1000).toFixed(0)}KB`);
        break;

      case 'model.temperature':
        configManager.setModelConfig({ temperature: parseFloat(value) });
        console.log(`Temperature set to: ${value}`);
        break;

      case 'search.engine':
        configManager.setSearchConfig({ engine: value as 'google' | 'bing' | 'duckduckgo' });
        console.log(`Search engine set to: ${value}`);
        break;

      case 'subagent.max':
        configManager.setSubAgentConfig({ maxConcurrent: parseInt(value) });
        console.log(`Max concurrent set to: ${value}`);
        break;

      case 'allow':
        configManager.allowTool(value);
        console.log(`Tool allowed: ${value}`);
        break;

      case 'block':
        configManager.blockTool(value);
        console.log(`Tool blocked: ${value}`);
        break;

      default:
        console.log(`Unknown key: ${key}`);
    }
  } catch (e) {
    console.log(`Error: ${e}`);
  }
}

/**
 * 显示允许的工具
 */
function showTools(configManager: ReturnType<typeof initConfig>): void {
  const config = configManager.getConfig();

  console.log('\nAllowed Tools:');
  console.log('─'.repeat(40));
  for (const tool of config.subAgent.allowedTools) {
    console.log(`  ✓ ${tool}`);
  }

  if (config.subAgent.blockedTools.length > 0) {
    console.log('\nBlocked Tools:');
    for (const tool of config.subAgent.blockedTools) {
      console.log(`  ✗ ${tool}`);
    }
  }

  console.log('');
}

/**
 * 显示可用命令
 */
function showCommands(): void {
  console.log('\nAvailable Commands:');
  console.log('─'.repeat(40));
  console.log('  /config           Show current configuration');
  console.log('  /set <k> <v>      Update configuration');
  console.log('  /set allow <tool> Allow a tool');
  console.log('  /set block <tool> Block a tool');
  console.log('  /tools            List allowed/block tools');
  console.log('  /help             Show this help');
  console.log('  /exit             Exit CLI');
  console.log('');
}

main().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});