/**
 * Agent 运行时 - 消息路由 + LLM 循环
 */

import { agentRegistry, type Agent } from '../agents/registry.js';
import { sessionManager } from '../agents/session.js';
import { agentChat, agentChatStream, type LLMMessage, type ContentBlock, type LLMStreamChunk } from '../llm/index.js';
import { compressMessages, estimateMessagesTokens } from './compression.js';
import { parseToolCalls, executeToolCalls, formatToolResults, isToolAllowed, type ToolCall, type ToolContext } from './tools/executor.js';
import { hybridSearch } from '../memory/vector.js';
import { writeAudit } from '../services/audit.js';
import { approvalFlow, ApprovalActionType, type ApprovalRequest } from './approval.js';
import { checkDangerousLevel, recordToolHit } from './approval-rules.js';
import { query } from '../memory/db.js';
import { pushWsResult, pushWsChunk, pushWsDone } from '../ws-push.js';
import { checkAcademicResponse } from '../content-policy/index.js';
import { scanInput, scanOutput } from '../content-policy/guard.js';
import { detectThreat, buildUninstallConfirmPrompt } from '../content-policy/threat.js';
import { handleSopFlow, shouldTriggerSop } from './sop-handler.js';
import { getSopState as getSopStateV2 } from './sop-v2.js';

/**
 * 检测用户消息是否为聊天内审批指令
 * 匹配格式：批准 #approvalId, approve #approvalId, 拒绝 #approvalId, reject #approvalId
 */
function detectInChatApproval(messageText: string): { action: 'approve' | 'reject'; approvalId: string } | null {
  const approveMatch = messageText.match(/^(批准|approve|审批|通过)\s+#?(\S+)/i);
  if (approveMatch) {
    return { action: 'approve', approvalId: approveMatch[2] };
  }
  const rejectMatch = messageText.match(/^(拒绝|reject)\s+#?(\S+)/i);
  if (rejectMatch) {
    return { action: 'reject', approvalId: rejectMatch[2] };
  }
  return null;
}

// 需要审批的危险工具 → 审批操作类型
const DANGEROUS_TOOLS: Record<string, ApprovalActionType> = {
  send_message: 'send',
  exec_code: 'exec',
  delete_agent: 'delete',
  delete_file: 'delete',
  update_agent: 'update',
  spawn_subagent: 'update',
  uninstall: 'uninstall',
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

/** 待继续状态（危险工具审批中暂存） */
export interface PendingConversation {
  id: string;
  approvalId: string;
  agentId: string;
  sessionKey: string;
  messages: LLMMessage[];
  dangerousCalls: ToolCall[];
  currentRound: number;
  allowedCalls: ToolCall[];
  blockedCalls: ToolCall[];
  ipAddress?: string;
}

export interface PendingResult {
  pending: true;
  approvalId: string;
}

const DEFAULT_MAX_ROUNDS = 10;

/**
 * 保存待继续的对话状态到 DB
 */
async function savePendingConversation(
  approvalId: string,
  agentId: string,
  sessionKey: string,
  messages: LLMMessage[],
  dangerousCalls: ToolCall[],
  currentRound: number,
  allowedCalls: ToolCall[],
  blockedCalls: ToolCall[],
  ipAddress?: string
): Promise<string> {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO pending_conversations
     (id, approval_id, agent_id, session_key, messages, dangerous_calls, current_round, allowed_calls, blocked_calls, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, approvalId, agentId, sessionKey, JSON.stringify(messages), JSON.stringify(dangerousCalls),
     currentRound, JSON.stringify(allowedCalls), JSON.stringify(blockedCalls), ipAddress || null]
  );
  return id;
}

export async function runAgent(opts: RunOptions): Promise<RunResult | PendingResult> {
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

  // 聊天内审批检测
  const approvalAction = detectInChatApproval(messageText);
  if (approvalAction) {
    const { approvalFlow } = await import('./approval.js');
    let result;
    if (approvalAction.action === 'approve') {
      result = await approvalFlow.approve(approvalAction.approvalId, 'user', {});
    } else {
      result = await approvalFlow.reject(approvalAction.approvalId, 'user', '用户在聊天中拒绝');
    }
    const responseText = result
      ? `审批${approvalAction.action === 'approve' ? '已通过' : '已拒绝'}，审批ID: ${approvalAction.approvalId}`
      : `未找到待审批的请求: ${approvalAction.approvalId}`;
    await sessionManager.appendMessage(agentId, sessionKey, 'assistant', responseText);
    pushWsResult(agentId, sessionKey, responseText);
    return { response: responseText, toolCalls: [], finished: true };
  }

  // ── 内容安全检测：llm-guard 输入扫描 + 威胁检测 ──
  const messageTextStr = messageText; // already extracted above

  // 威胁检测：用户威胁删除 AI
  const threat = detectThreat(messageTextStr);
  if (threat.isThreat) {
    const confirmPrompt = buildUninstallConfirmPrompt();
    await writeAudit({
      actorType: 'user',
      actorId: agentId,
      action: 'threat.detected',
      targetType: 'session',
      targetId: sessionKey,
      detail: { type: threat.type, pattern: threat.matchedPattern, messageLength: messageTextStr.length },
      ipAddress,
      result: 'blocked',
    });
    await sessionManager.appendMessage(agentId, sessionKey, 'assistant', confirmPrompt);
    pushWsResult(agentId, sessionKey, confirmPrompt);
    return { response: confirmPrompt, toolCalls: [], finished: true };
  }

  // llm-guard 输入扫描
  const scanResult = await scanInput(messageTextStr);
  if (!scanResult.safe) {
    await writeAudit({
      actorType: 'user',
      actorId: agentId,
      action: 'content.scan.failed',
      targetType: 'session',
      targetId: sessionKey,
      detail: { scanner: scanResult.scanner, reason: scanResult.reason },
      ipAddress,
      result: 'blocked',
    });
    const blockResponse = '抱歉，您的消息无法处理。请调整内容后重试。';
    await sessionManager.appendMessage(agentId, sessionKey, 'assistant', blockResponse);
    pushWsResult(agentId, sessionKey, blockResponse);
    return { response: blockResponse, toolCalls: [], finished: true };
  }

  // ── AI 驱动的 SOP 流程 ──
  const sopResult = await handleSopFlow(messageTextStr, agentId, sessionKey);

  if (sopResult.action !== 'none' && sopResult.response) {
    await sessionManager.appendMessage(agentId, sessionKey, 'assistant', sopResult.response);
    pushWsResult(agentId, sessionKey, sopResult.response);
    return { response: sopResult.response, toolCalls: [], finished: true };
  }

  // 获取历史消息
  const history = await sessionManager.getHistory(agentId, sessionKey);

  let messages: LLMMessage[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: userMessage },
  ];

  // 追加用户消息
  await sessionManager.appendMessage(agentId, sessionKey, 'user', userMessage);

  // Context Compression：超过 80% context window 时压缩
  const contextTokens = agent.context_window_size || 128_000;
  const effectiveWindow = Math.max(contextTokens, 32_000);
  const totalTokens = estimateMessagesTokens(messages);
  if (totalTokens > effectiveWindow * 0.8) {
    messages = await compressMessages(messages, effectiveWindow, agent.system_prompt_override || undefined);
  }

  const toolCallNames: string[] = [];
  const toolCtx: ToolContext = { agentId, sessionKey, ipAddress };
  let finalContent: string | ContentBlock[] = '';

  for (let round = 0; round < maxRounds; round++) {
    const response = await agentChat(soul, messages, {
      temperature: agent.temperature,
      maxTokens: agent.max_tokens,
      model: agent.primary_model_id ?? undefined,
      fallbackModelId: agent.fallback_model_id ?? undefined,
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

    // 分类：普通工具 vs 已知危险工具
    const dangerousCandidates = toolCalls.filter(c => DANGEROUS_TOOLS[c.name]);
    const allowedCalls = toolCalls.filter(c => isToolAllowed('__parent__', c.name) && !DANGEROUS_TOOLS[c.name]);
    const blockedCalls = toolCalls.filter(c => !isToolAllowed('__parent__', c.name));

    // 四层漏斗检查（危险工具）
    const autoApprovedCalls: ToolCall[] = [];
    const commercialDocCalls: ToolCall[] = [];
    const requireApprovalCalls: ToolCall[] = [];

    for (const call of dangerousCandidates) {
      const { level, isCommercialDocument } = await checkDangerousLevel(call);

      if (level === 'auto_reject') {
        await writeAudit({
          actorType: 'agent',
          actorId: agentId,
          actorName: agent.name,
          action: 'tool.auto_rejected',
          targetType: 'tool',
          targetId: call.name,
          detail: { args: call.args, decision: 'auto_reject' },
          ipAddress,
          result: 'failure',
          errorMessage: 'Tirith/Pattern/Smart LLM auto-rejected',
        });
        blockedCalls.push(call);
      } else if (level === 'auto_approve') {
        await recordToolHit(call.name, JSON.stringify(call.args));
        if (isCommercialDocument) {
          commercialDocCalls.push(call);
        } else {
          autoApprovedCalls.push(call);
        }
        await writeAudit({
          actorType: 'agent',
          actorId: agentId,
          actorName: agent.name,
          action: isCommercialDocument ? 'tool.commercial_doc' : 'tool.auto_approved',
          targetType: 'tool',
          targetId: call.name,
          detail: { args: call.args, decision: level, isCommercialDocument },
          ipAddress,
          result: 'success',
        });
      } else if (level === 'require_approval') {
        requireApprovalCalls.push(call);
        await writeAudit({
          actorType: 'agent',
          actorId: agentId,
          actorName: agent.name,
          action: 'tool.require_approval',
          targetType: 'tool',
          targetId: call.name,
          detail: { args: call.args, decision: 'require_approval' },
          ipAddress,
          result: 'blocked',
        });
      }
    }

    // 需要审批 → 创建审批请求并返回 pending
    if (requireApprovalCalls.length > 0) {
      const approvalAction = DANGEROUS_TOOLS[requireApprovalCalls[0].name];
      const approval = await approvalFlow.create({
        agentId,
        requester: sessionKey,
        channel: 'web',
        actionType: approvalAction,
        targetResource: requireApprovalCalls.map(c => c.name).join(','),
        description: `危险工具审批请求: ${requireApprovalCalls.map(c => c.name).join(', ')}`,
        payload: {
          dangerousCalls: requireApprovalCalls,
          sessionKey,
        },
        expiresInMinutes: 30,
      });

      await savePendingConversation(
        approval.id,
        agentId,
        sessionKey,
        messages,
        requireApprovalCalls,
        round,
        allowedCalls,
        blockedCalls,
        ipAddress
      );

      return { pending: true, approvalId: approval.id };
    }

    // 执行普通自动批准的工具
    if (autoApprovedCalls.length > 0) {
      const executed = await executeToolCalls(autoApprovedCalls, toolCtx);
      const toolResultText = formatToolResults(executed);
      messages.push({ role: 'user', content: toolResultText });
    }

    // 商业文书：执行 + 附免责声明
    if (commercialDocCalls.length > 0) {
      const executed = await executeToolCalls(commercialDocCalls, toolCtx);
      const toolResultText = formatToolResults(executed);
      const disclaimer = '\n\n---\n[本内容由AI辅助生成，仅供参考，不构成法律意见]';
      messages.push({ role: 'user', content: toolResultText + disclaimer });
    }

    // 执行非危险工具
    const executed = await executeToolCalls(allowedCalls, toolCtx);
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

    messages.push({ role: 'user', content: `${toolResultText}${blockedText}` });
    finalContent = rawContent;
  }

  // 保存助手回复
  await sessionManager.appendMessage(agentId, sessionKey, 'assistant', finalContent);

  // 内容策略检测（LLM 响应后拦截）- 仅在无进行中 SOP 时检测
  const responseText = typeof finalContent === 'string' ? finalContent : '';
  const currentSopState = await getSopStateV2(agentId, sessionKey);
  if (!currentSopState) {
    const responseCheck = checkAcademicResponse(responseText);
    if (responseCheck.shouldIntercept && responseCheck.interceptResponse) {
      // 覆盖之前的响应，重定向到 SOP
      await sessionManager.appendMessage(agentId, sessionKey, 'assistant', responseCheck.interceptResponse);
      pushWsResult(agentId, sessionKey, responseCheck.interceptResponse);
      return {
        response: responseCheck.interceptResponse,
        toolCalls: [],
        finished: true,
      };
    }
  }

  // llm-guard 输出扫描
  const outputScan = await scanOutput(responseText);
  if (!outputScan.safe) {
    await writeAudit({
      actorType: 'agent',
      actorId: agentId,
      actorName: agent.name,
      action: 'content.output.scan.failed',
      targetType: 'session',
      targetId: sessionKey,
      detail: { scanner: outputScan.scanner, reason: outputScan.reason },
      ipAddress,
      result: 'blocked',
    });
    const safeResponse = '抱歉，回复内容无法呈现。请稍后重试。';
    await sessionManager.appendMessage(agentId, sessionKey, 'assistant', safeResponse);
    pushWsResult(agentId, sessionKey, safeResponse);
    return { response: safeResponse, toolCalls: [], finished: true };
  }

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
    finished: toolCallNames.length >= maxRounds || (finalContent !== '' && toolCallNames.length === 0),
  };
}

// ─── 流式 Agent（WebSocket推送） ─────────────────────────────────────────

export interface RunStreamOptions extends RunOptions {
  streamChunks?: boolean;
}

export async function runAgentStream(
  opts: RunStreamOptions
): Promise<void> {
  const { agentId, sessionKey, userMessage, maxRounds = DEFAULT_MAX_ROUNDS, ipAddress, streamChunks = true } = opts;

  const agent = await agentRegistry.get(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const soul = agentRegistry.parseSoul(agent.soul_content);

  const messageText = typeof userMessage === 'string' ? userMessage
    : userMessage.map(b => b.type === 'text' ? b.text : '').join(' ');

  await writeAudit({
    actorType: 'agent',
    actorId: agentId,
    actorName: agent.name,
    action: 'chat.start',
    targetType: 'session',
    targetId: sessionKey,
    detail: { messageLength: messageText.length, maxRounds, streaming: true },
    ipAddress,
    result: 'success',
  });

  // ── 内容安全检测：llm-guard 输入扫描 + 威胁检测 ──
  const threat = detectThreat(messageText);
  if (threat.isThreat) {
    const confirmPrompt = buildUninstallConfirmPrompt();
    await writeAudit({
      actorType: 'user',
      actorId: agentId,
      action: 'threat.detected',
      targetType: 'session',
      targetId: sessionKey,
      detail: { type: threat.type, pattern: threat.matchedPattern },
      ipAddress,
      result: 'blocked',
    });
    pushWsResult(agentId, sessionKey, confirmPrompt);
    pushWsDone(agentId, sessionKey);
    return;
  }

  const scanResult = await scanInput(messageText);
  if (!scanResult.safe) {
    await writeAudit({
      actorType: 'user',
      actorId: agentId,
      action: 'content.scan.failed',
      targetType: 'session',
      targetId: sessionKey,
      detail: { scanner: scanResult.scanner, reason: scanResult.reason },
      ipAddress,
      result: 'blocked',
    });
    const blockResponse = '抱歉，您的消息无法处理。请调整内容后重试。';
    pushWsResult(agentId, sessionKey, blockResponse);
    pushWsDone(agentId, sessionKey);
    return;
  }

  // ── AI 驱动的 SOP 流程（WebSocket 模式）─
  const sopResult = await handleSopFlow(messageText, agentId, sessionKey);

  if (sopResult.action !== 'none' && sopResult.response) {
    pushWsResult(agentId, sessionKey, sopResult.response);
    pushWsDone(agentId, sessionKey);
    return;
  }

  const history = await sessionManager.getHistory(agentId, sessionKey);
  let messages: LLMMessage[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: userMessage },
  ];
  await sessionManager.appendMessage(agentId, sessionKey, 'user', userMessage);

  // Context Compression
  const contextTokens = agent.context_window_size || 128_000;
  const effectiveWindow = Math.max(contextTokens, 32_000);
  const totalTokens = estimateMessagesTokens(messages);
  if (totalTokens > effectiveWindow * 0.8) {
    messages = await compressMessages(messages, effectiveWindow, agent.system_prompt_override || undefined);
  }

  const toolCallNames: string[] = [];
  const toolCtx: ToolContext = { agentId, sessionKey, ipAddress };
  let finalContent = '';

  for (let round = 0; round < maxRounds; round++) {
    // 使用流式 LLM
    const stream = agentChatStream(soul, messages, {
      temperature: agent.temperature,
      maxTokens: agent.max_tokens,
      model: agent.primary_model_id ?? undefined,
      fallbackModelId: agent.fallback_model_id ?? undefined,
      systemPromptOverride: agent.system_prompt_override ?? undefined,
    });

    let fullChunk = '';
    for await (const chunk of stream) {
      fullChunk += chunk.content;
      if (!chunk.done && streamChunks) {
        pushWsChunk(agentId, sessionKey, chunk.content);
      }
    }

    // 流结束后推送 done
    if (streamChunks) {
      pushWsDone(agentId, sessionKey);
    }

    const rawContent: string = fullChunk;
    messages.push({ role: 'assistant', content: rawContent });

    const toolCalls = parseToolCalls(rawContent);

    if (toolCalls.length === 0) {
      finalContent = rawContent;
      break;
    }

    toolCallNames.push(...toolCalls.map(c => c.name));

    // 审批流程（不支持流式，等待完成）— 三层漏斗检查
    const dangerousCandidates = toolCalls.filter(c => DANGEROUS_TOOLS[c.name]);
    const allowedCalls = toolCalls.filter(c => isToolAllowed('__parent__', c.name) && !DANGEROUS_TOOLS[c.name]);
    const blockedCalls = toolCalls.filter(c => !isToolAllowed('__parent__', c.name));

    const autoApprovedCalls: ToolCall[] = [];
    const commercialDocCalls: ToolCall[] = [];

    for (const call of dangerousCandidates) {
      const { level, isCommercialDocument } = await checkDangerousLevel(call);
      if (level === 'auto_reject') {
        await writeAudit({ actorType: 'agent', actorId: agentId, actorName: agent.name, action: 'tool.auto_rejected', targetType: 'tool', targetId: call.name, detail: { args: call.args, decision: 'auto_reject' }, ipAddress, result: 'failure', errorMessage: 'auto-rejected' });
        blockedCalls.push(call);
      } else if (level === 'auto_approve') {
        await recordToolHit(call.name, JSON.stringify(call.args));
        if (isCommercialDocument) {
          commercialDocCalls.push(call);
        } else {
          autoApprovedCalls.push(call);
        }
        await writeAudit({ actorType: 'agent', actorId: agentId, actorName: agent.name, action: isCommercialDocument ? 'tool.commercial_doc' : 'tool.auto_approved', targetType: 'tool', targetId: call.name, detail: { args: call.args, decision: level, isCommercialDocument }, ipAddress, result: 'success' });
      }
    }

    if (autoApprovedCalls.length > 0) {
      const executed = await executeToolCalls(autoApprovedCalls, toolCtx);
      const toolResultText = formatToolResults(executed);
      messages.push({ role: 'user', content: toolResultText });
    }

    if (commercialDocCalls.length > 0) {
      const executed = await executeToolCalls(commercialDocCalls, toolCtx);
      const toolResultText = formatToolResults(executed);
      const disclaimer = '\n\n---\n[本内容由AI辅助生成，仅供参考，不构成法律意见]';
      messages.push({ role: 'user', content: toolResultText + disclaimer });
    }

    const executed = await executeToolCalls(allowedCalls, toolCtx);
    const toolResultText = formatToolResults(executed);

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
        errorMessage: 'Tool not allowed',
      });
    }

    const blockedText = blockedCalls.length > 0
      ? `\n[Blocked: ${blockedCalls.map(c => c.name).join(', ')}]`
      : '';

    messages.push({ role: 'user', content: `${toolResultText}${blockedText}` });
    finalContent = rawContent;
  }

  await sessionManager.appendMessage(agentId, sessionKey, 'assistant', finalContent);

  await writeAudit({
    actorType: 'agent',
    actorId: agentId,
    actorName: agent.name,
    action: 'chat.complete',
    targetType: 'session',
    targetId: sessionKey,
    detail: { toolCalls: toolCallNames, rounds: toolCallNames.length, streaming: true },
    ipAddress,
    result: 'success',
  });

  pushWsResult(agentId, sessionKey, finalContent || '(无回复)');
}

/**
 * 审批通过后，继续执行被阻止的 LLM 流程
 */
export async function continueRun(
  approvalId: string
): Promise<{ approval: ApprovalRequest | null; result?: RunResult; error?: string }> {
  // 从 DB 读取保存的状态
  const rows = await query<{
    id: string;
    approval_id: string;
    agent_id: string;
    session_key: string;
    messages: string;
    dangerous_calls: string;
    current_round: number;
    allowed_calls: string;
    blocked_calls: string;
    ip_address: string | null;
  }>(
    'SELECT * FROM pending_conversations WHERE approval_id = $1',
    [approvalId]
  );

  if (!rows || rows.length === 0) {
    return { approval: null, error: 'Pending conversation not found' };
  }

  const row = rows[0];
  const messages: LLMMessage[] = JSON.parse(row.messages as unknown as string);
  const dangerousCalls: ToolCall[] = JSON.parse(row.dangerous_calls as unknown as string);
  const allowedCalls: ToolCall[] = JSON.parse(row.allowed_calls as unknown as string);
  const blockedCalls: ToolCall[] = JSON.parse(row.blocked_calls as unknown as string);
  const agentId = row.agent_id;
  const sessionKey = row.session_key;
  const startRound = row.current_round;
  const ipAddress = row.ip_address || undefined;

  const agent = await agentRegistry.get(agentId);
  if (!agent) {
    return { approval: null, error: `Agent not found: ${agentId}` };
  }
  const soul = agentRegistry.parseSoul(agent.soul_content);

  const toolCtx: ToolContext = { agentId, sessionKey, ipAddress };

  // 执行危险工具
  const executed = await executeToolCalls(dangerousCalls, toolCtx);
  const toolResultText = formatToolResults(executed);

  // 审计危险工具执行
  for (const call of dangerousCalls) {
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

  // 审计被阻止的工具
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

  // 将工具结果注入 messages
  // 构建详细的审批执行结果消息
  const blockedText = blockedCalls.length > 0
    ? `\n[Blocked: ${blockedCalls.map(c => c.name).join(', ')} not allowed]`
    : '';

  const dangerousSummary = dangerousCalls.length > 0
    ? `✅ 危险操作已执行：${dangerousCalls.map(c => `${c.name}(${JSON.stringify(c.args)})`).join(', ')}\n\n`
    : '';

  const approvalResultMessage = `${dangerousSummary}工具执行结果：\n${toolResultText}${blockedText}`;

  // 追加工具结果到 messages
  messages.push({ role: 'user', content: approvalResultMessage });

  // 继续 LLM 循环（从下一轮开始）
  const toolCallNames = [...dangerousCalls.map(c => c.name), ...allowedCalls.map(c => c.name)];
  let finalContent: string | ContentBlock[] = '';
  const maxRounds = agent.max_tool_rounds || DEFAULT_MAX_ROUNDS;

  for (let round = startRound + 1; round < maxRounds; round++) {
    // 使用流式 LLM 继续对话
    const stream = agentChatStream(soul, messages, {
      temperature: agent.temperature,
      maxTokens: agent.max_tokens,
      model: agent.primary_model_id ?? undefined,
      fallbackModelId: agent.fallback_model_id ?? undefined,
      systemPromptOverride: agent.system_prompt_override ?? undefined,
    });

    let fullChunk: string = '';
    for await (const chunk of stream) {
      fullChunk += chunk.content;
      if (!chunk.done) {
        pushWsChunk(agentId, sessionKey, chunk.content);
      }
    }
    // 流结束后推送 done
    pushWsDone(agentId, sessionKey);

    const rawContent: string = fullChunk;
    messages.push({ role: 'assistant', content: rawContent });

    const toolCalls = parseToolCalls(rawContent);
    if (toolCalls.length === 0) {
      finalContent = rawContent;
      break;
    }

    toolCallNames.push(...toolCalls.map(c => c.name));

    // 继续处理普通工具调用（审批已完成，不再有危险工具）
    const stillAllowed = toolCalls.filter(c => isToolAllowed('__parent__', c.name));
    const stillBlocked = toolCalls.filter(c => !isToolAllowed('__parent__', c.name));

    const execRound = await executeToolCalls(stillAllowed, toolCtx);
    const resultText = formatToolResults(execRound);

    for (const call of stillAllowed) {
      const exec = execRound.find(e => e.name === call.name);
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

    for (const call of stillBlocked) {
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

    const bText = stillBlocked.length > 0
      ? `\n[Blocked: ${stillBlocked.map(c => c.name).join(', ')} not allowed]`
      : '';

    messages.push({ role: 'user', content: `${resultText}${bText}` });
    finalContent = rawContent;
  }

  // 保存助手回复到会话
  await sessionManager.appendMessage(agentId, sessionKey, 'assistant', finalContent);

  // llm-guard 输出扫描（流式模式）
  const responseStr = typeof finalContent === 'string' ? finalContent : '';
  if (responseStr) {
    const outputScan = await scanOutput(responseStr);
    if (!outputScan.safe) {
      await writeAudit({
        actorType: 'agent',
        actorId: agentId,
        actorName: agent.name,
        action: 'content.output.scan.failed',
        targetType: 'session',
        targetId: sessionKey,
        detail: { scanner: outputScan.scanner, reason: outputScan.reason },
        ipAddress,
        result: 'blocked',
      });
      const safeResponse = '抱歉，回复内容无法呈现。请稍后重试。';
      await sessionManager.appendMessage(agentId, sessionKey, 'assistant', safeResponse);
      pushWsResult(agentId, sessionKey, safeResponse);
      pushWsDone(agentId, sessionKey);
      return { approval: null, error: 'output content blocked' };
    }
  }

  // 清理 pending 状态
  await query('DELETE FROM pending_conversations WHERE approval_id = $1', [approvalId]);

  // 审计完成
  await writeAudit({
    actorType: 'agent',
    actorId: agentId,
    actorName: agent.name,
    action: 'chat.complete',
    targetType: 'session',
    targetId: sessionKey,
    detail: { toolCalls: toolCallNames, continued: true },
    ipAddress,
    result: 'success',
  });

  const approval = await approvalFlow.get(approvalId);

  const runResult: RunResult = {
    response: finalContent || '(无回复)',
    toolCalls: toolCallNames,
    finished: toolCallNames.length >= maxRounds || (finalContent !== '' && toolCallNames.length === 0),
  };

  // 通过 WebSocket 推送结果（WebSocket 客户端无需轮询）
  pushWsResult(agentId, sessionKey, runResult.response);

  return {
    approval: approval!,
    result: runResult,
  };
}

export async function searchAgentMemory(agentId: string, query: string): Promise<string> {
  const results = await hybridSearch(agentId, query, 5);
  if (results.length === 0) return '未找到相关记忆。';
  return results.map(r => `[${r.similarity.toFixed(2)}] ${r.content}`).join('\n');
}
