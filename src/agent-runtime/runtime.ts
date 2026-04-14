/**
 * Agent 运行时 - 消息路由 + LLM 循环
 */

import { agentRegistry, type Agent } from '../agents/registry.js';
import { sessionManager } from '../agents/session.js';
import { agentChat, type LLMMessage, type ContentBlock } from '../llm/index.js';
import { parseToolCalls, executeToolCalls, formatToolResults, isToolAllowed } from './tools/executor.js';
import { hybridSearch } from '../memory/vector.js';
import { writeAudit } from '../services/audit.js';
import { approvalFlow, ApprovalActionType } from './approval.js';

// 需要审批的危险工具 → 审批操作类型
const DANGEROUS_TOOLS: Record<string, ApprovalActionType> = {
  send_message: 'send',
  exec_code: 'exec',
  delete_agent: 'delete',
  update_agent: 'update',
  spawn_subagent: 'update',
};

export interface RunOptions {
  agentId: string;
  sessionKey: string;
  userMessage: string | ContentBlock[];
  maxRounds?: number;
  ipAddress?: string;
}

export interface RunResult {
  response: string | ContentBlock[];
  toolCalls: string[];
  finished: boolean;
}

const DEFAULT_MAX_ROUNDS = 10;

export async function runAgent(opts: RunOptions): Promise<RunResult> {
  const { agentId, sessionKey, userMessage, maxRounds = DEFAULT_MAX_ROUNDS, ipAddress } = opts;

  const agent = await agentRegistry.get(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const soul = agentRegistry.parseSoul(agent.soul_content);

  // 审计：聊天开始
  const messageText = typeof userMessage === 'string' ? userMessage
    : userMessage.map(b => b.type === 'text' ? b.text : '').join(' ');

  await writeAudit({
    actorType: 'agent',
    actorId: agentId,
    actorName: agent.name,
    action: 'chat.start',
    targetType: 'session',
    targetId: sessionKey,
    detail: { messageLength: messageText.length, maxRounds },
    ipAddress,
    result: 'success',
  });

  // 获取历史消息
  const history = await sessionManager.getHistory(agentId, sessionKey);

  const messages: LLMMessage[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: userMessage },
  ];

  // 追加用户消息
  await sessionManager.appendMessage(agentId, sessionKey, 'user', userMessage);

  const toolCallNames: string[] = [];
  let finalContent: string | ContentBlock[] = '';

  for (let round = 0; round < maxRounds; round++) {
    const response = await agentChat(soul, messages, {
      temperature: agent.temperature,
      maxTokens: agent.max_tokens,
      model: agent.primary_model_id ?? undefined,
      systemPromptOverride: agent.system_prompt_override ?? undefined,
    });

    const rawContent = response.content;
    messages.push({ role: 'assistant', content: rawContent });

    // 解析工具调用时需要文本
    const rawText = typeof rawContent === 'string' ? rawContent
      : rawContent.map(b => b.type === 'text' ? b.text : `[${b.type}]`).join(' ');

    const toolCalls = parseToolCalls(rawText);

    if (toolCalls.length === 0) {
      finalContent = rawContent;
      break;
    }

    toolCallNames.push(...toolCalls.map(c => c.name));

    // 分类：需要审批的危险工具 vs 普通工具
    const dangerousCalls = toolCalls.filter(c => DANGEROUS_TOOLS[c.name]);
    const allowedCalls = toolCalls.filter(c => isToolAllowed('__parent__', c.name) && !DANGEROUS_TOOLS[c.name]);
    const blockedCalls = toolCalls.filter(c => !isToolAllowed('__parent__', c.name));

    // 危险工具：创建审批请求并等待
    for (const call of dangerousCalls) {
      const actionType = DANGEROUS_TOOLS[call.name];
      await approvalFlow.create({
        agentId,
        requester: agent.name,
        channel: 'api',
        actionType,
        targetResource: JSON.stringify(call.args),
        description: `危险操作: ${call.name}`,
        payload: call.args,
      });

      await writeAudit({
        actorType: 'agent',
        actorId: agentId,
        actorName: agent.name,
        action: 'approval.requested',
        targetType: 'tool',
        targetId: call.name,
        detail: { args: call.args, actionType },
        ipAddress,
        result: 'success',
      });
    }

    // 执行非危险工具
    const executed = await executeToolCalls(allowedCalls);
    const toolResultText = formatToolResults(executed);

    // 审计：工具执行
    for (const call of allowedCalls) {
      const exec = executed.find(e => e.name === call.name);
      await writeAudit({
        actorType: 'agent',
        actorId: agentId,
        actorName: agent.name,
        action: 'tool.execute',
        targetType: 'tool',
        targetId: call.name,
        detail: { args: call.args, success: exec?.success },
        ipAddress,
        result: exec?.success ? 'success' : 'failure',
        errorMessage: exec?.error,
      });
    }

    // 审计：工具被阻止
    for (const call of blockedCalls) {
      await writeAudit({
        actorType: 'agent',
        actorId: agentId,
        actorName: agent.name,
        action: 'tool.blocked',
        targetType: 'tool',
        targetId: call.name,
        detail: { args: call.args },
        ipAddress,
        result: 'failure',
        errorMessage: 'Tool not allowed for this agent',
      });
    }

    const blockedText = blockedCalls.length > 0
      ? `\n[Blocked: ${blockedCalls.map(c => c.name).join(', ')} not allowed]`
      : '';

    const dangerousText = dangerousCalls.length > 0
      ? `\n[需要审批: ${dangerousCalls.map(c => c.name).join(', ')} - 请在 /api/approvals 批准]`
      : '';

    messages.push({ role: 'user', content: `${toolResultText}${blockedText}${dangerousText}` });
    finalContent = rawContent;
  }

  // 保存助手回复
  await sessionManager.appendMessage(agentId, sessionKey, 'assistant', finalContent);

  // 审计：聊天完成
  await writeAudit({
    actorType: 'agent',
    actorId: agentId,
    actorName: agent.name,
    action: 'chat.complete',
    targetType: 'session',
    targetId: sessionKey,
    detail: { toolCalls: toolCallNames, rounds: toolCallNames.length },
    ipAddress,
    result: 'success',
  });

  return {
    response: finalContent || '(无回复)',
    toolCalls: toolCallNames,
    finished: toolCallNames.length === 0 || toolCallNames.length >= maxRounds,
  };
}

export async function searchAgentMemory(agentId: string, query: string): Promise<string> {
  const results = await hybridSearch(agentId, query, 5);
  if (results.length === 0) return '未找到相关记忆。';
  return results.map(r => `[${r.similarity.toFixed(2)}] ${r.content}`).join('\n');
}
