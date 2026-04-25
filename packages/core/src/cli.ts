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

interface CLIConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
}

async function main() {
  // 从环境变量读取配置
  const provider = (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'anthropic';
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';

  if (!apiKey) {
    console.error('Error: No API key provided. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
    process.exit(1);
  }

  // 创建 LLM Provider
  const llm = provider === 'openai'
    ? new OpenAIProvider({ apiKey, defaultModel: process.env.OPENAI_MODEL || 'gpt-4o' })
    : new AnthropicProvider({ apiKey, defaultModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514' });

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

  console.log('ColoBot CLI - Ready');
  console.log(`Provider: ${provider}`);
  console.log(`Model: ${llm.name}`);
  console.log('\nType your message and press Enter. Ctrl+C to exit.\n');

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

    try {
      const result = await runtime.run({
        agentId: 'cli-agent',
        sessionKey: 'cli-session',
        userMessage: message,
      });

      console.log(`\nResponse: ${result.response}\n`);
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

main().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});