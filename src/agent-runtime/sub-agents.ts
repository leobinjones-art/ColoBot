/**
 * 子智能体 - 临时任务分解
 * 纯内存存在，TTL自动过期，父子关系权限控制
 */

export interface SubAgentConfig {
  name: string;
  soul_content: string;
  parentId: string;
  ttlMs?: number;
  allowedTools?: string[];
}

export interface SubAgent {
  id: string;
  name: string;
  soul_content: string;
  parentId: string;
  allowedTools: string[];
  createdAt: number;
  expiresAt: number;
  status: 'idle' | 'busy' | 'done';
}

const subAgents = new Map<string, SubAgent>();
const CLEANUP_INTERVAL = 30_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

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
  const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ttlMs = config.ttlMs ?? 5 * 60 * 1000;
  const now = Date.now();

  const agent: SubAgent = {
    id,
    name: config.name,
    soul_content: config.soul_content,
    parentId: config.parentId,
    allowedTools: config.allowedTools ?? ['search_memory', 'add_memory', 'delegate_task'],
    createdAt: now,
    expiresAt: now + ttlMs,
    status: 'idle',
  };

  subAgents.set(id, agent);
  console.log(`[SubAgent] Spawned: ${agent.name} (${id}) parent=${config.parentId} ttl=${ttlMs}ms`);
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

  try {
    const { agentChat } = await import('../llm/index.js');
    const soul = JSON.parse(subAgent.soul_content || '{}');
    const maxRounds = 5;

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: buildSubAgentSystemPrompt(soul) },
      { role: 'user', content: task },
    ];

    let finalContent = '';

    for (let round = 0; round < maxRounds; round++) {
      const response = await agentChat(soul, messages as any, {});
      const rawContent = response.content;

      const { parseToolCalls, stripToolCalls, executeToolCalls, formatToolResults } = await import('./tools/executor.js');
      const toolCalls = parseToolCalls(rawContent);

      if (toolCalls.length === 0) {
        finalContent = stripToolCalls(rawContent);
        messages.push({ role: 'assistant', content: rawContent });
        break;
      }

      messages.push({ role: 'assistant', content: rawContent });

      const allowedCalls = toolCalls.filter(call => isToolAllowed(subAgent.id, call.name));
      const blockedCalls = toolCalls.filter(call => !isToolAllowed(subAgent.id, call.name));

      const executed = await executeToolCalls(allowedCalls);
      const toolResultText = formatToolResults(executed);

      const blockedText = blockedCalls.length > 0
        ? `\n[Blocked: ${blockedCalls.map(c => c.name).join(', ')} not allowed]`
        : '';

      messages.push({ role: 'user', content: `${toolResultText}${blockedText}` });
      finalContent = stripToolCalls(rawContent);
    }

    setSubAgentStatus(subAgent.id, 'done');
    return finalContent || '(无回复)';
  } catch (e) {
    setSubAgentStatus(subAgent.id, 'idle');
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
