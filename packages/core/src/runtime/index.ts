/**
 * Agent 运行时核心逻辑
 */

import type { LLMMessage, ContentBlock, ToolCall, ToolContext } from '@colobot/types';
import type {
  RuntimeDeps,
  LLMResponse,
  ScanResult,
} from './types.js';

export interface RunOptions {
  agentId: string;
  sessionKey: string;
  userMessage: string | ContentBlock[];
  maxRounds?: number;
  ipAddress?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface RunResult {
  response: string | ContentBlock[];
  toolCalls: string[];
  finished: boolean;
}

const DEFAULT_MAX_ROUNDS = 10;

/**
 * Agent 运行时
 */
export class AgentRuntime {
  constructor(private deps: RuntimeDeps) {}

  async run(opts: RunOptions): Promise<RunResult> {
    const {
      agentId,
      sessionKey,
      userMessage,
      maxRounds = DEFAULT_MAX_ROUNDS,
      ipAddress,
      systemPrompt,
      temperature,
      maxTokens,
    } = opts;

    // 获取历史
    const history = await this.deps.memory.getHistory(agentId, sessionKey);

    // 构建消息
    const messages: LLMMessage[] = [
      ...history,
      { role: 'user', content: userMessage },
    ];

    // 追加用户消息
    await this.deps.memory.append(agentId, sessionKey, 'user', userMessage);

    // 输入扫描
    const messageText = typeof userMessage === 'string' ? userMessage
      : userMessage.map(b => b.type === 'text' ? b.text : '').join(' ');

    const inputScan = await this.deps.scanner.scanInput(messageText);
    if (!inputScan.safe) {
      const blocked = `[Message blocked: ${inputScan.reason}]`;
      await this.deps.memory.append(agentId, sessionKey, 'assistant', blocked);
      return { response: blocked, toolCalls: [], finished: true };
    }

    const toolCallNames: string[] = [];
    const toolCtx: ToolContext = { agentId, sessionKey, ipAddress };
    let finalContent: string | ContentBlock[] = '';

    // LLM 循环
    for (let round = 0; round < maxRounds; round++) {
      const response = await this.deps.llm.chat(messages, {
        temperature,
        maxTokens,
      });

      const rawContent = response.content;
      messages.push({ role: 'assistant', content: rawContent });

      // 解析工具调用
      const rawText = typeof rawContent === 'string' ? rawContent
        : rawContent.map(b => b.type === 'text' ? b.text : `[${b.type}]`).join(' ');

      const toolCalls = this.deps.tools.parse(rawText);

      if (toolCalls.length === 0) {
        finalContent = rawContent;
        break;
      }

      toolCallNames.push(...toolCalls.map(c => c.name));

      // 执行工具
      const results = await this.deps.tools.execute(toolCalls, toolCtx);
      const resultText = this.deps.tools.format(results);

      messages.push({ role: 'user', content: resultText });
      finalContent = rawContent;
    }

    // 保存助手回复
    await this.deps.memory.append(agentId, sessionKey, 'assistant', finalContent);

    // 输出扫描
    const responseText = typeof finalContent === 'string' ? finalContent : '';
    const outputScan = await this.deps.scanner.scanOutput(responseText);
    if (!outputScan.safe) {
      const blocked = `[Output blocked: ${outputScan.reason}]`;
      await this.deps.memory.append(agentId, sessionKey, 'assistant', blocked);
      return { response: blocked, toolCalls: [], finished: true };
    }

    return {
      response: finalContent || '(no response)',
      toolCalls: toolCallNames,
      finished: toolCallNames.length >= maxRounds || (finalContent !== '' && toolCallNames.length === 0),
    };
  }

  /**
   * 流式运行
   */
  async *runStream(opts: RunOptions): AsyncGenerator<string | ContentBlock[], void, unknown> {
    const {
      agentId,
      sessionKey,
      userMessage,
      maxRounds = DEFAULT_MAX_ROUNDS,
      temperature,
      maxTokens,
    } = opts;

    const history = await this.deps.memory.getHistory(agentId, sessionKey);
    const messages: LLMMessage[] = [
      ...history,
      { role: 'user', content: userMessage },
    ];

    await this.deps.memory.append(agentId, sessionKey, 'user', userMessage);

    const messageText = typeof userMessage === 'string' ? userMessage
      : userMessage.map(b => b.type === 'text' ? b.text : '').join(' ');

    const inputScan = await this.deps.scanner.scanInput(messageText);
    if (!inputScan.safe) {
      yield `[Message blocked: ${inputScan.reason}]`;
      return;
    }

    const toolCtx: ToolContext = { agentId, sessionKey, ipAddress: opts.ipAddress };

    for (let round = 0; round < maxRounds; round++) {
      for await (const chunk of this.deps.llm.chatStream(messages, { temperature, maxTokens })) {
        if (chunk.type === 'text' && chunk.content) {
          yield chunk.content;
        }
      }

      // 简化：流式模式暂不处理工具调用
      break;
    }
  }
}

export * from './types.js';
