#!/usr/bin/env node
/**
 * ColoBot CLI 入口
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { AgentRuntime, registerBuiltinTools } from './index.js';
import { OpenAIProvider, AnthropicProvider } from './providers/index.js';
import { SQLiteStore } from './adapters/sqlite-store.js';
import { ToolExecutorImpl } from './adapters/tools.js';
import { NoOpScanner } from './adapters/scanner.js';
import { ConsoleAudit } from './adapters/audit.js';
import { ConsolePusher } from './adapters/pusher.js';
import { initConfig } from './config/index.js';
import { setGlobalAllowedTools } from './subagents/index.js';
import { configureSearch } from './search.js';
import { toolRegistry } from './tools/registry.js';

const HELP_TEXT = `
ColoBot - Multi-modal AI Assistant

Usage:
  colobot [command]

Commands:
  init        Interactive configuration
  tui         Terminal UI interface
  help        Show help
  version     Show version

Interactive commands:
  /config     Show configuration
  /set        Update configuration
  /tools      List tools
  /help       Show help
  /exit       Exit program

Config file:
  ~/.colobot/config.json
`;

const HELP_TEXT_ZH = `
ColoBot - 多模态 AI 助手

用法:
  colobot [命令]

命令:
  init        交互式配置
  tui         终端交互界面
  help        显示帮助
  version     显示版本

交互命令:
  /config     显示配置
  /set        更新配置
  /tools      显示工具列表
  /help       显示帮助
  /exit       退出程序

配置文件:
  ~/.colobot/config.json
`;

// 多语言文本
const i18n = {
  zh: {
    welcome: '\n欢迎使用 ColoBot！首次运行需要配置。\n',
    selectProvider: '选择 LLM 提供商:\n',
    pleaseSelect: '请选择: ',
    invalidSelect: '无效选择',
    custom: '自定义',
    apiUrl: 'API 地址 (如 https://api.example.com/v1): ',
    apiKey: 'API 密钥: ',
    apiKeyEmpty: 'API 密钥不能为空',
    modelName: '模型名称: ',
    modelNameEmpty: '模型名称不能为空',
    selectModel: '\n选择模型:\n',
    selectSearchEngine: '\n选择搜索引擎:\n',
    selectSearchDefault: '请选择 (默认 duckduckgo): ',
    configSaved: '\n配置已保存！运行 colobot 启动。\n',
    providerOptions: [
      { name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
      { name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-7'] },
      { name: '自定义', models: [] },
    ],
  },
  en: {
    welcome: '\nWelcome to ColoBot! First run requires configuration.\n',
    selectProvider: 'Select LLM provider:\n',
    pleaseSelect: 'Select: ',
    invalidSelect: 'Invalid selection',
    custom: 'Custom',
    apiUrl: 'API URL (e.g. https://api.example.com/v1): ',
    apiKey: 'API Key: ',
    apiKeyEmpty: 'API Key cannot be empty',
    modelName: 'Model name: ',
    modelNameEmpty: 'Model name cannot be empty',
    selectModel: '\nSelect model:\n',
    selectSearchEngine: '\nSelect search engine:\n',
    selectSearchDefault: 'Select (default: duckduckgo): ',
    configSaved: '\nConfiguration saved! Run colobot to start.\n',
    providerOptions: [
      { name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
      { name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-7'] },
      { name: 'Custom', models: [] },
    ],
  },
};

type Lang = 'zh' | 'en';

const PROVIDER_OPTIONS = [
  { name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-7'] },
  { name: '自定义', models: [] },
];

/**
 * 交互式配置
 */
async function interactiveInit(): Promise<void> {
  // 0. 选择语言
  console.log('\nSelect language / 选择语言:\n');
  console.log('  1. 中文');
  console.log('  2. English\n');

  const langIdx = await askInput('Select / 选择: ');
  const lang: Lang = langIdx === '2' ? 'en' : 'zh';
  const t = i18n[lang];

  console.log(t.welcome);

  // 1. 选择 Provider
  console.log(t.selectProvider);
  t.providerOptions.forEach((p, i) => console.log(`  ${i + 1}. ${p.name}`));
  console.log('');

  const providerIdx = await askInput(t.pleaseSelect);
  const idx = parseInt(providerIdx, 10) - 1;
  if (idx < 0 || idx >= t.providerOptions.length) {
    console.log(t.invalidSelect);
    process.exit(1);
  }

  const selected = t.providerOptions[idx];
  const provider = selected.name.toLowerCase() === t.custom.toLowerCase() ? 'custom' : selected.name.toLowerCase();

  // 2. 自定义则输入 baseUrl
  let baseUrl: string | undefined;
  if (provider === 'custom') {
    baseUrl = await askInput(t.apiUrl);
  }

  // 3. 输入 API Key
  const apiKey = await askInput(t.apiKey);
  if (!apiKey) {
    console.log(t.apiKeyEmpty);
    process.exit(1);
  }

  // 4. 选择/输入模型
  let model: string;
  if (provider === 'custom' || selected.models.length === 0) {
    model = await askInput(t.modelName);
    if (!model) {
      console.log(t.modelNameEmpty);
      process.exit(1);
    }
  } else {
    console.log(t.selectModel);
    selected.models.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
    console.log('');

    const modelIdx = await askInput(t.pleaseSelect);
    const midx = parseInt(modelIdx, 10) - 1;
    model = midx >= 0 && midx < selected.models.length ? selected.models[midx] : selected.models[0];
  }

  // 5. 选择搜索引擎
  console.log(t.selectSearchEngine);
  const searchEngines = ['duckduckgo', 'google', 'bing', 'searxng', 'baidu'];
  searchEngines.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  console.log('');

  const searchIdx = await askInput(t.selectSearchDefault);
  const sidx = parseInt(searchIdx, 10) - 1;
  const searchEngine = sidx >= 0 && sidx < searchEngines.length ? searchEngines[sidx] : 'duckduckgo';

  // 保存配置
  const configDir = path.join(process.env.HOME || '', '.colobot');
  const configPath = path.join(configDir, 'config.json');
  const config = {
    model: { provider, model, apiKey, baseUrl },
    search: { engine: searchEngine, maxResults: 10, timeout: 30000 },
    subAgent: {
      maxConcurrent: 10,
      defaultTtlMs: 300000,
      defaultTimeoutMs: 300000,
      allowedTools: ['read_file', 'write_file', 'list_dir', 'web_search', 'python', 'http'],
      blockedTools: ['delete_file', 'execute_shell'],
    },
    audit: { enabled: true, level: 'info' },
    memory: { type: 'inmemory', maxEntries: 10000 },
    ui: { lang },
  };

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(t.configSaved);
}

function askInput(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * 启动 TUI
 */
async function startTui(): Promise<void> {
  // 动态加载 TUI 模块
  const { TUI } = await import('@colobot/tui');
  const tui = new TUI();

  tui.commands.register('/exit', '退出程序', () => {
    console.log('\n再见！\n');
    process.exit(0);
  });

  await tui.start('ColoBot TUI');
  console.log('输入 /help 查看可用命令\n');
  await tui.run(async (message) => message);
}

/**
 * 启动 CLI
 */
async function startCli(): Promise<void> {
  const configManager = initConfig();
  const config = configManager.getConfig();

  setGlobalAllowedTools(config.subAgent.allowedTools);

  configureSearch({
    engine: config.search.engine as 'searxng' | 'duckduckgo' | 'google' | 'bing',
    apiKey: config.search.apiKey,
    cx: config.search.cx,
    baseUrl: config.search.baseUrl,
    maxResults: config.search.maxResults,
    timeout: config.search.timeout,
  });

  const apiKey = config.model.apiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    '';

  if (!apiKey) {
    console.error('Error: No API key provided. Run `colobot init` first.');
    process.exit(1);
  }

  const llm = config.model.provider === 'openai'
    ? new OpenAIProvider({ apiKey, defaultModel: config.model.model, baseUrl: config.model.baseUrl })
    : new AnthropicProvider({ apiKey, defaultModel: config.model.model });

  registerBuiltinTools();

  const memory = new SQLiteStore({
    path: path.join(process.env.HOME || '', '.colobot', 'chat.db'),
  });

  const runtime = new AgentRuntime({
    llm,
    memory,
    tools: new ToolExecutorImpl(toolRegistry),
    scanner: new NoOpScanner(),
    audit: new ConsoleAudit(),
    pusher: new ConsolePusher(),
  });

  console.log('╔══════════════════════════════════════╗');
  console.log('║          ColoBot CLI Ready           ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`\nProvider: ${config.model.provider}`);
  console.log(`Model: ${config.model.model}`);
  console.log('输入 /help 查看可用命令\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const message = line.trim();
    if (!message) { rl.prompt(); return; }

    if (message.startsWith('/')) {
      handleCommand(message, configManager, rl);
      return;
    }

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

function handleCommand(cmd: string, configManager: ReturnType<typeof initConfig>, rl: readline.Interface): void {
  const parts = cmd.split(' ');
  const command = parts[0];

  switch (command) {
    case '/config':
      showConfig(configManager);
      break;
    case '/tools':
      showTools(configManager);
      break;
    case '/help':
      console.log('\n命令: /config, /tools, /help, /exit\n');
      break;
    case '/exit':
    case '/quit':
      rl.close();
      return;
    default:
      console.log(`Unknown command: ${command}`);
  }
  rl.prompt();
}

function showConfig(configManager: ReturnType<typeof initConfig>): void {
  const config = configManager.getConfig();
  console.log(`\nProvider: ${config.model.provider}`);
  console.log(`Model: ${config.model.model}`);
  console.log(`Search: ${config.search.engine}\n`);
}

function showTools(configManager: ReturnType<typeof initConfig>): void {
  const config = configManager.getConfig();
  console.log('\n允许的工具:');
  config.subAgent.allowedTools.forEach(t => console.log(`  ✓ ${t}`));
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  const firstArg = args[0];

  // 读取配置中的语言设置
  const configPath = path.join(process.env.HOME || '', '.colobot', 'config.json');
  let lang: Lang = 'en';  // 默认英文
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      lang = config.ui?.lang || 'en';
    }
  } catch {
    // ignore
  }

  if (firstArg === 'help' || firstArg === '-h' || firstArg === '--help') {
    console.log(lang === 'zh' ? HELP_TEXT_ZH : HELP_TEXT);
    process.exit(0);
  }

  if (firstArg === 'version' || firstArg === '-v' || firstArg === '--version') {
    console.log(`ColoBot v${process.env.npm_package_version || '0.1.0'}`);
    process.exit(0);
  }

  if (firstArg === 'init') {
    await interactiveInit();
    process.exit(0);
  }

  if (firstArg === 'tui') {
    await startTui();
    process.exit(0);
  }

  // 默认启动 CLI
  await startCli();
}

main().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
