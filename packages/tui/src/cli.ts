#!/usr/bin/env node
/**
 * ColoBot CLI 入口
 */

import { TUI, printError, printSuccess, style, printTable } from './index.js';
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

async function main() {
  // 初始化配置
  const configManager = initConfig();
  const config = configManager.getConfig();

  // 设置工具白名单
  setGlobalAllowedTools(config.subAgent.allowedTools);

  // 注册内置工具
  registerBuiltinTools();

  // 获取 API Key
  const apiKey = config.model.apiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    '';

  if (!apiKey) {
    printError('缺少 API Key');
    console.log('\n请设置环境变量:');
    console.log('  export OPENAI_API_KEY=your-key');
    console.log('  或');
    console.log('  export ANTHROPIC_API_KEY=your-key\n');
    process.exit(1);
  }

  // 创建 LLM
  const llm = config.model.provider === 'openai'
    ? new OpenAIProvider({ apiKey, defaultModel: config.model.model })
    : new AnthropicProvider({ apiKey, defaultModel: config.model.model });

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
  printError('启动失败', error);
  process.exit(1);
});
