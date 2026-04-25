/**
 * 测试运行时（使用 Mock LLM）
 */

import { AgentRuntime, ToolRegistry, registerBuiltinTools, InMemoryStore, ToolExecutorImpl, NoOpScanner, ConsoleAudit, ConsolePusher } from './index.js';
import type { LLMProvider, LLMResponse, LLMStreamChunk } from './runtime/types.js';

async function test() {
  // Mock LLM (不调用真实 API)
  const mockLlm: LLMProvider = {
    name: 'mock',
    chat: async () => ({ content: 'Hello! I am a mock AI assistant.' }),
    chatStream: async function* (): AsyncIterable<LLMStreamChunk> {
      yield { type: 'text', content: 'Hello!' };
      yield { type: 'done' };
    },
  };

  const toolRegistry = new ToolRegistry();
  registerBuiltinTools();

  const runtime = new AgentRuntime({
    llm: mockLlm,
    memory: new InMemoryStore(),
    tools: new ToolExecutorImpl(toolRegistry),
    scanner: new NoOpScanner(),
    audit: new ConsoleAudit(),
    pusher: new ConsolePusher(),
  });

  console.log('Testing AgentRuntime...\n');

  const result = await runtime.run({
    agentId: 'test-agent',
    sessionKey: 'test-session',
    userMessage: 'Hello!',
  });

  console.log('Response:', result.response);
  console.log('Tool Calls:', result.toolCalls);
  console.log('Finished:', result.finished);
}

test().catch(console.error);