#!/usr/bin/env node
/**
 * ColoBot CLI 入口
 *
 * 使用方式:
 *   npx colobot                  # 简单 CLI 模式
 *   npx colobot tui              # TUI 界面
 *   npx colobot --provider anthropic --model claude-sonnet-4-20250514
 */

import * as readline from 'readline';
import { startColoBot, createRuntime } from './server.js';
import { printError, printSuccess, style } from '@colobot/tui';

interface CLIArgs {
  help: boolean;
  version: boolean;
  tui: boolean;
  provider?: 'openai' | 'anthropic';
  model?: string;
  searchEngine?: 'duckduckgo' | 'google' | 'bing';
  apiKey?: string;
  config?: string;
  maxConcurrent?: number;
  allowedTools?: string;
}

function parseArgs(args: string[]): CLIArgs {
  const result: CLIArgs = {
    help: false,
    version: false,
    tui: false,
  };

  const validProviders = ['openai', 'anthropic'];
  const validSearchEngines = ['duckduckgo', 'google', 'bing'];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
    } else if (arg === 'tui') {
      result.tui = true;
    } else if (arg === '--provider' && args[i + 1]) {
      const provider = args[i + 1];
      if (!validProviders.includes(provider)) {
        console.error(`错误: 无效的 provider "${provider}"，可选值: ${validProviders.join(', ')}`);
        process.exit(1);
      }
      result.provider = provider as 'openai' | 'anthropic';
      i++;
    } else if (arg === '--model' && args[i + 1]) {
      result.model = args[i + 1];
      i++;
    } else if (arg === '--search' && args[i + 1]) {
      const engine = args[i + 1];
      if (!validSearchEngines.includes(engine)) {
        console.error(`错误: 无效的搜索引擎 "${engine}"，可选值: ${validSearchEngines.join(', ')}`);
        process.exit(1);
      }
      result.searchEngine = engine as 'duckduckgo' | 'google' | 'bing';
      i++;
    } else if (arg === '--api-key' && args[i + 1]) {
      result.apiKey = args[i + 1];
      i++;
    } else if (arg === '--config' && args[i + 1]) {
      result.config = args[i + 1];
      i++;
    } else if (arg === '--max-concurrent' && args[i + 1]) {
      const val = parseInt(args[i + 1]);
      if (isNaN(val) || val < 1) {
        console.error(`错误: --max-concurrent 必须是正整数`);
        process.exit(1);
      }
      result.maxConcurrent = val;
      i++;
    } else if (arg === '--allowed-tools' && args[i + 1]) {
      result.allowedTools = args[i + 1];
      i++;
    } else if (arg.startsWith('--')) {
      console.error(`错误: 未知选项 "${arg}"`);
      console.error('使用 --help 查看可用选项');
      process.exit(1);
    }
  }

  return result;
}

const HELP_TEXT = `
ColoBot CLI - AI 智能体协作平台

使用方式:
  npx colobot                  简单 CLI 模式
  npx colobot tui              TUI 界面

选项:
  --provider <name>     LLM Provider (openai, anthropic)
  --model <name>        模型名称
  --search <engine>     搜索引擎 (duckduckgo, google, bing)
  --api-key <key>       API Key
  --config <path>       配置文件路径
  --max-concurrent <n>  最大并发子 Agent 数
  --allowed-tools <list> 允许的工具列表（逗号分隔）
  --version, -v         显示版本
  --help, -h            显示帮助

环境变量:
  OPENAI_API_KEY        OpenAI API Key
  ANTHROPIC_API_KEY     Anthropic API Key

示例:
  npx colobot
  npx colobot tui
  npx colobot --provider anthropic --model claude-sonnet-4-20250514
  npx colobot tui --search duckduckgo
  npx colobot --max-concurrent 5 --allowed-tools "read_file,web_search"
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (args.version) {
    const pkg = await import('../package.json', { assert: { type: 'json' } });
    console.log(`ColoBot v${pkg.default.version}`);
    process.exit(0);
  }

  try {
    if (args.tui) {
      // TUI 模式
      await startColoBot({
        apiKey: args.apiKey,
        provider: args.provider,
        model: args.model,
        searchEngine: args.searchEngine,
        configPath: args.config,
        maxConcurrent: args.maxConcurrent,
        allowedTools: args.allowedTools,
        enableTUI: true,
      });
    } else {
      // 简单 CLI 模式
      const { runtime, configManager } = createRuntime({
        apiKey: args.apiKey,
        provider: args.provider,
        model: args.model,
        searchEngine: args.searchEngine,
        configPath: args.config,
        maxConcurrent: args.maxConcurrent,
        allowedTools: args.allowedTools,
      });

      const config = configManager.getConfig();
      const caps = configManager.getModelCapabilities();

      console.log('');
      console.log('╔══════════════════════════════════════╗');
      console.log('║       ColoBot CLI Ready              ║');
      console.log('╚══════════════════════════════════════╝');
      console.log('');
      console.log(`Provider: ${style(config.model.provider, 'cyan')}`);
      console.log(`Model: ${style(config.model.model, 'cyan')}`);
      console.log(`Context: ${style(caps.contextWindow.toLocaleString(), 'cyan')} tokens`);
      console.log('');
      console.log(`输入消息开始对话，输入 ${style('/exit', 'cyan')} 退出`);
      console.log('');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> ',
      });

      rl.prompt();

      rl.on('line', async (line) => {
        const message = line.trim();

        if (!message) {
          rl.prompt();
          return;
        }

        if (message === '/exit' || message === '/quit') {
          console.log('\n再见！\n');
          rl.close();
          return;
        }

        if (message === '/config') {
          console.log('\n当前配置:');
          console.log(`  Provider: ${config.model.provider}`);
          console.log(`  Model: ${config.model.model}`);
          console.log(`  Search: ${config.search.engine}`);
          console.log('');
          rl.prompt();
          return;
        }

        try {
          const result = await runtime.run({
            agentId: 'cli-agent',
            sessionKey: 'cli-session',
            userMessage: message,
          });

          if (typeof result.response === 'string') {
            console.log(`\n${result.response}\n`);
          } else {
            const text = result.response
              .map(b => b.type === 'text' ? b.text : `[${b.type}]`)
              .join('');
            console.log(`\n${text}\n`);
          }
        } catch (e) {
          printError('执行失败', e instanceof Error ? e : new Error(String(e)));
        }

        rl.prompt();
      });

      rl.on('close', () => {
        process.exit(0);
      });
    }
  } catch (e) {
    printError('启动失败', e instanceof Error ? e : new Error(String(e)));
    process.exit(1);
  }
}

main();