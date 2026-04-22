/**
 * 子智能体 - 临时任务分解
 * 纯内存存在，TTL自动过期，父子关系权限控制
 */

import type { LLMMessage, ContentBlock } from '../llm/index.js';
import type { ToolContext } from './tools/executor.js';

export interface SubAgentConfig {
  name: string;
  soul_content: string;
  parentId: string;
  ttlMs?: number;
  allowedTools?: string[];
  fallbackModelId?: string;
  workspacePath?: string;
  taskTimeoutMs?: number;
}

export interface SubAgent {
  id: string;
  name: string;
  soul_content: string;
  parentId: string;
  allowedTools: string[];
  workspacePath: string;
  createdAt: number;
  expiresAt: number;
  status: 'idle' | 'busy' | 'done' | 'timeout' | 'error';
  fallbackModelId?: string;
  taskTimeoutMs?: number;
}

const subAgents = new Map<string, SubAgent>();
const CLEANUP_INTERVAL = 30_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

// ── 并发限制 ──────────────────────────────────────────────
const MAX_CONCURRENT_TOTAL = 10;
const MAX_CONCURRENT_PER_PARENT = 3;
const DEFAULT_TASK_TIMEOUT_MS = 5 * 60 * 1000; // 默认任务超时 5 分钟

function countBusyTotal(): number {
  let count = 0;
  for (const a of subAgents.values()) {
    if (a.status === 'busy') count++;
  }
  return count;
}

function countBusyByParent(parentId: string): number {
  let count = 0;
  for (const a of subAgents.values()) {
    if (a.parentId === parentId && a.status === 'busy') count++;
  }
  return count;
}

function checkConcurrency(parentId: string): void {
  if (countBusyTotal() >= MAX_CONCURRENT_TOTAL) {
    throw new Error(`子Agent并发已达上限(${MAX_CONCURRENT_TOTAL})，请稍后再试`);
  }
  if (countBusyByParent(parentId) >= MAX_CONCURRENT_PER_PARENT) {
    throw new Error(`该父Agent并发已达上限(${MAX_CONCURRENT_PER_PARENT})，请减少同时创建的子Agent数量`);
  }
}

function startCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, agent] of subAgents) {
      if (now > agent.expiresAt) {
        console.log(`[SubAgent] Expired: ${agent.name} (${id})`);
        subAgents.delete(id);
      }
    }
  }, CLEANUP_INTERVAL);
}

export function spawnSubAgent(config: SubAgentConfig): SubAgent {
  startCleanup();
  checkConcurrency(config.parentId);
  const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ttlMs = config.ttlMs ?? 5 * 60 * 1000;
  const now = Date.now();

  const workspacePath = config.workspacePath ?? `/workspace/${config.name}`;

  const agent: SubAgent = {
    id,
    name: config.name,
    soul_content: config.soul_content,
    parentId: config.parentId,
    allowedTools: config.allowedTools ?? ['search_memory', 'add_memory', 'delegate_task', 'read_file', 'write_file', 'list_dir'],
    workspacePath,
    createdAt: now,
    expiresAt: now + ttlMs,
    status: 'idle',
    fallbackModelId: config.fallbackModelId,
    taskTimeoutMs: config.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS,
  };

  subAgents.set(id, agent);
  console.log(`[SubAgent] Spawned: ${agent.name} (${id}) parent=${config.parentId} workspace=${workspacePath} ttl=${ttlMs}ms`);
  return agent;
}

export function getSubAgent(id: string): SubAgent | undefined {
  return subAgents.get(id);
}

export function listSubAgents(parentId: string): SubAgent[] {
  return Array.from(subAgents.values()).filter(a => a.parentId === parentId);
}

export function destroySubAgent(id: string, parentId: string): boolean {
  const agent = subAgents.get(id);
  if (!agent) return false;
  if (agent.parentId !== parentId) {
    console.warn(`[SubAgent] Unauthorized destroy: ${id} by ${parentId}`);
    return false;
  }
  subAgents.delete(id);
  console.log(`[SubAgent] Destroyed: ${agent.name} (${id})`);
  return true;
}

export function setSubAgentStatus(id: string, status: SubAgent['status']): void {
  const agent = subAgents.get(id);
  if (agent) agent.status = status;
}

export function touchSubAgent(id: string, extraMs = 60_000): boolean {
  const agent = subAgents.get(id);
  if (!agent) return false;
  agent.expiresAt = Date.now() + extraMs;
  return true;
}

export function isToolAllowed(subAgentId: string, toolName: string): boolean {
  const agent = subAgents.get(subAgentId);
  if (!agent) return false;
  return agent.allowedTools.includes(toolName);
}

export function getSubAgentWorkspacePath(subAgentId: string): string | null {
  const agent = subAgents.get(subAgentId);
  return agent?.workspacePath ?? null;
}

export async function runSubAgentTask(
  subAgent: SubAgent,
  task: string,
  parentId: string
): Promise<string> {
  if (subAgent.parentId !== parentId) {
    throw new Error('Unauthorized: parent mismatch');
  }

  touchSubAgent(subAgent.id, 60_000);
  setSubAgentStatus(subAgent.id, 'busy');

  const { writeAudit } = await import('../services/audit.js');

  await writeAudit({
    actorType: 'subagent',
    actorId: subAgent.id,
    actorName: subAgent.name,
    action: 'subagent.task.start',
    targetType: 'task',
    targetId: subAgent.id,
    detail: { taskLength: task.length, parentId },
    result: 'success',
  }).catch(e => console.error('[SubAgent] writeAudit error:', e)); // non-blocking

  try {
    const { agentChat } = await import('../llm/index.js');
    const soul = JSON.parse(subAgent.soul_content || '{}');
    const maxRounds = 5;
    const timeoutMs = subAgent.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;

    const messages: LLMMessage[] = [
      { role: 'system', content: buildSubAgentSystemPrompt(soul) },
      { role: 'user', content: task },
    ];

    let finalContent = '';

    for (let round = 0; round < maxRounds; round++) {
      // 每轮 LLM 调用加超时
      const response = await Promise.race([
        agentChat(soul, messages as any, {
          fallbackModelId: subAgent.fallbackModelId,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM调用超时')), timeoutMs)
        ),
      ]);
      const rawContent = response.content;

      // 多模态 content 转为文本供工具解析
      const rawText = typeof rawContent === 'string' ? rawContent
        : rawContent.map((b: ContentBlock) => b.type === 'text' ? b.text : `[${b.type}]`).join(' ');

      const { parseToolCalls, executeToolCalls, formatToolResults } = await import('./tools/executor.js');
      const toolCalls = parseToolCalls(rawText);

      if (toolCalls.length === 0) {
        finalContent = rawText;
        messages.push({ role: 'assistant', content: rawContent });
        break;
      }

      messages.push({ role: 'assistant', content: rawContent });

      const allowedCalls = toolCalls.filter(call => isToolAllowed(subAgent.id, call.name));
      const blockedCalls = toolCalls.filter(call => !isToolAllowed(subAgent.id, call.name));

      // 注入 sub_agent_id 到工具参数（供工作区沙箱使用）
      for (const call of allowedCalls) {
        call.args.sub_agent_id = subAgent.id;
      }

      const toolCtx: ToolContext = { agentId: subAgent.id, sessionKey: '' };
      const executed = await executeToolCalls(allowedCalls, toolCtx);
      const toolResultText = formatToolResults(executed);

      for (const call of allowedCalls) {
        const exec = executed.find(e => e.name === call.name);
        await writeAudit({
          actorType: 'subagent',
          actorId: subAgent.id,
          actorName: subAgent.name,
          action: 'tool.execute',
          targetType: 'tool',
          targetId: call.name,
          detail: { args: call.args, success: exec?.success },
          result: exec?.success ? 'success' : 'failure',
          errorMessage: exec?.error,
        }).catch(() => {});
      }

      for (const call of blockedCalls) {
        await writeAudit({
          actorType: 'subagent',
          actorId: subAgent.id,
          actorName: subAgent.name,
          action: 'tool.blocked',
          targetType: 'tool',
          targetId: call.name,
          detail: { args: call.args },
          result: 'failure',
          errorMessage: 'Tool not allowed',
        }).catch(() => {});
      }

      const blockedText = blockedCalls.length > 0
        ? `\n[Blocked: ${blockedCalls.map(c => c.name).join(', ')} not allowed]`
        : '';

      messages.push({ role: 'user', content: `${toolResultText}${blockedText}` });
      finalContent = rawText;
    }

    setSubAgentStatus(subAgent.id, 'done');
    await writeAudit({
      actorType: 'subagent',
      actorId: subAgent.id,
      actorName: subAgent.name,
      action: 'subagent.task.complete',
      targetType: 'task',
      targetId: subAgent.id,
      detail: { rounds: maxRounds },
      result: 'success',
    }).catch(() => {});

    return finalContent || '(无回复)';
  } catch (e) {
    const isTimeout = String(e).includes('超时');
    setSubAgentStatus(subAgent.id, isTimeout ? 'timeout' : 'error');
    await writeAudit({
      actorType: 'subagent',
      actorId: subAgent.id,
      actorName: subAgent.name,
      action: isTimeout ? 'subagent.task.timeout' : 'subagent.task.error',
      targetType: 'task',
      targetId: subAgent.id,
      detail: {},
      result: 'failure',
      errorMessage: String(e),
    }).catch(() => {});
    throw e;
  }
}

function buildSubAgentSystemPrompt(soul: { role?: string; personality?: string; rules?: string[]; skills?: string[] }): string {
  const parts: string[] = [`你是 ${soul.role || '助手'}。`];
  if (soul.personality) parts.push(`\n## 性格\n${soul.personality}`);
  if (soul.rules?.length) parts.push(`\n## 规则\n${soul.rules.map((r: string) => `- ${r}`).join('\n')}`);
  if (soul.skills?.length) parts.push(`\n## 技能\n${soul.skills.map((s: string) => `- ${s}`).join('\n')}`);
  return parts.join('\n');
}
