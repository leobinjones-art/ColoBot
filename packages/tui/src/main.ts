/**
 * ColoBot CLI 主模块
 */

import { TUI, printError, printSuccess, style, printTable, ask, select } from './index.js';
import {
  initConfig,
  setGlobalAllowedTools,
  registerBuiltinTools,
  OpenAIProvider,
  AnthropicProvider,
  AgentRuntime,
  ToolRegistry,
  InMemoryStore,
  ToolExecutorImpl,
  NoOpScanner,
  ConsoleAudit,
  ConsolePusher,
} from '@colobot/core';
import * as fs from 'fs';
import * as path from 'path';

// 模型选项
const PROVIDER_OPTIONS = [
  { name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-7'] },
  { name: '自定义', models: [] },
];

/**
 * 交互式初始化配置
 */
async function interactiveInit(): Promise<{ provider: string; model: string; apiKey: string; baseUrl?: string; searchEngine: string }> {
  console.log('\n欢迎使用 ColoBot！首次运行需要配置。\n');

  // 1. 选择 Provider
  console.log('选择 LLM 提供商:\n');
  PROVIDER_OPTIONS.forEach((p, i) => console.log(`  ${i + 1}. ${p.name}`));
  console.log('');

  const providerIdx = await ask('请选择: ');
  const idx = parseInt(providerIdx, 10) - 1;
  if (idx < 0 || idx >= PROVIDER_OPTIONS.length) {
    printError('无效选择');
    process.exit(1);
  }

  const selected = PROVIDER_OPTIONS[idx];
  const provider = selected.name.toLowerCase() === '自定义' ? 'custom' : selected.name.toLowerCase();

  // 2. 自定义则输入 baseUrl
  let baseUrl: string | undefined;
  if (provider === 'custom') {
    baseUrl = await ask('API 地址 (如 https://api.example.com/v1): ');
  }

  // 3. 输入 API Key
  const apiKey = await ask('API 密钥: ');
  if (!apiKey) {
    printError('API 密钥不能为空');
    process.exit(1);
  }

  // 4. 选择/输入模型
  let model: string;
  if (provider === 'custom' || selected.models.length === 0) {
    model = await ask('模型名称: ');
    if (!model) {
      printError('模型名称不能为空');
      process.exit(1);
    }
  } else {
    console.log('\n选择模型:\n');
    selected.models.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
    console.log('');

    const modelIdx = await ask('请选择: ');
    const midx = parseInt(modelIdx, 10) - 1;
    model = midx >= 0 && midx < selected.models.length ? selected.models[midx] : selected.models[0];
  }

  // 5. 选择搜索引擎
  console.log('\n选择搜索引擎:\n');
  const searchEngines = ['duckduckgo', 'google', 'bing', 'searxng'];
  searchEngines.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  console.log('');

  const searchIdx = await ask('请选择 (默认 duckduckgo): ');
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
  };

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  printSuccess(`配置已保存\n`);

  return { provider, model, apiKey, baseUrl, searchEngine };
}

/**
 * 确认提示（简化版）
 */
async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await ask(`${question} ${hint}: `);
  if (!answer) return defaultYes;
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

async function main() {
  const firstArg = process.argv[2];

  // init 命令强制进入交互式配置
  if (firstArg === 'init') {
    const initResult = await interactiveInit();
    console.log(`\n配置完成！运行 colobot 启动。\n`);
    process.exit(0);
  }

  // 初始化配置
  const configManager = initConfig();
  const config = configManager.getConfig();

  // 设置工具白名单
  setGlobalAllowedTools(config.subAgent.allowedTools);

  // 注册内置工具
  registerBuiltinTools();

  // 获取 API Key（优先级：配置文件 > 环境变量）
  let apiKey = config.model.apiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    '';

  // 没有配置则交互式初始化
  let baseUrl = config.model.baseUrl;
  if (!apiKey) {
    const initResult = await interactiveInit();
    apiKey = initResult.apiKey;
    config.model.provider = initResult.provider as 'openai' | 'anthropic' | 'custom';
    config.model.model = initResult.model;
    if (initResult.baseUrl) {
      baseUrl = initResult.baseUrl;
      config.model.baseUrl = baseUrl;
    }
  }

  // 创建 LLM
  let llm;
  if (config.model.provider === 'custom' || baseUrl) {
    // 自定义 provider 使用 OpenAI 兼容接口
    llm = new OpenAIProvider({
      apiKey,
      defaultModel: config.model.model,
      baseUrl: baseUrl,
    });
  } else if (config.model.provider === 'anthropic') {
    llm = new AnthropicProvider({ apiKey, defaultModel: config.model.model });
  } else {
    llm = new OpenAIProvider({ apiKey, defaultModel: config.model.model });
  }

  // 创建运行时
  const runtime = new AgentRuntime({
    llm,
    memory: new InMemoryStore(),
    tools: new ToolExecutorImpl(new ToolRegistry()),
    scanner: new NoOpScanner(),
    audit: new ConsoleAudit(),
    pusher: new ConsolePusher(),
  });

  // 创建 TUI
  const tui = new TUI();

  // 注册命令
  tui.commands.register('/exit', '退出程序', () => {
    console.log('\n再见！\n');
    process.exit(0);
  });

  tui.commands.register('/version', '显示版本', () => {
    console.log(`\nColoBot v${process.env.npm_package_version || '0.1.0'}\n`);
  });

  tui.commands.register('/config', '显示配置', () => {
    const caps = configManager.getModelCapabilities();
    console.log('\n当前配置:\n');
    printTable(
      ['配置项', '值'],
      [
        ['Provider', config.model.provider],
        ['Model', config.model.model],
        ['Context', `${caps.contextWindow.toLocaleString()} tokens`],
        ['Chunk Size', `${(caps.recommendedChunkSize / 1000).toFixed(0)}KB`],
        ['Search', config.search.engine],
        ['Max Agents', String(config.subAgent.maxConcurrent)],
      ]
    );
  });

  tui.commands.register('/tools', '显示工具', () => {
    const tools = config.subAgent.allowedTools;
    console.log('\n允许的工具:\n');
    tools.forEach(t => console.log(`  ${style('✓', 'green')} ${t}`));
    console.log('');
  });

  // 启动 TUI
  await tui.start('ColoBot');

  console.log(`Provider: ${style(config.model.provider, 'cyan')}`);
  console.log(`Model: ${style(config.model.model, 'cyan')}`);
  console.log(`输入 ${style('/help', 'cyan')} 查看可用命令\n`);

  // 运行交互循环
  await tui.run(async (message) => {
    const result = await runtime.run({
      agentId: 'cli-agent',
      sessionKey: 'cli-session',
      userMessage: message,
    });

    // 处理响应
    const response = result.response;
    if (typeof response === 'string') {
      return response;
    }
    // ContentBlock[] 转换为字符串
    return response.map(b => b.type === 'text' ? b.text : `[${b.type}]`).join('');
  });
}

main().catch((error) => {
  console.error('启动失败:', error);
  process.exit(1);
});
