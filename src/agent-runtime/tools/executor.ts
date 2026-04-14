/**
 * 工具执行器 - 解析、执行工具调用
 */

import { searchMemory, addMemory, hybridSearch } from '../../memory/vector.js';

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  success: boolean;
  result: unknown;
  error?: string;
}

// 工具注册表
const toolRegistry = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();

function registerTool(name: string, fn: (args: Record<string, unknown>) => Promise<unknown>): void {
  toolRegistry.set(name, fn);
}

// ─── 内置工具 ───────────────────────────────────────────────

registerTool('search_memory', async (args) => {
  const { agent_id, query, top_k } = args as { agent_id: string; query: string; top_k?: number };
  return hybridSearch(agent_id, query, top_k ?? 5);
});

registerTool('add_memory', async (args) => {
  const { agent_id, key, value, metadata } = args as {
    agent_id: string;
    key: string;
    value: string;
    metadata?: Record<string, unknown>;
  };
  await addMemory(agent_id, key, value, metadata ?? {});
  return { ok: true };
});

registerTool('list_memory', async (args) => {
  const { agent_id } = args as { agent_id: string };
  const { listMemory } = await import('../../memory/vector.js');
  return listMemory(agent_id);
});

registerTool('delegate_task', async (args) => {
  const { sub_agent_id, task } = args as { sub_agent_id: string; task: string };
  const { runSubAgentTask, getSubAgent } = await import('../sub-agents.js');
  const agent = getSubAgent(sub_agent_id);
  if (!agent) throw new Error(`SubAgent not found: ${sub_agent_id}`);
  return runSubAgentTask(agent, task, agent.parentId);
});

registerTool('spawn_subagent', async (args) => {
  const { name, soul_content, parent_id, ttl_ms, allowed_tools } = args as {
    name: string;
    soul_content: string;
    parent_id: string;
    ttl_ms?: number;
    allowed_tools?: string[];
  };
  const { spawnSubAgent } = await import('../sub-agents.js');
  const agent = spawnSubAgent({
    name,
    soul_content,
    parentId: parent_id,
    ttlMs: ttl_ms,
    allowedTools: allowed_tools,
  });
  return { id: agent.id, name: agent.name };
});

registerTool('get_time', async () => {
  return new Date().toISOString();
});

registerTool('web_search', async (args) => {
  const { query, safe_search, time_range, categories } = args as {
    query: string;
    safe_search?: number;
    time_range?: string;
    categories?: string[];
  };
  const { searxngSearch } = await import('../../search/searxng.js');
  return searxngSearch(query, {
    safe_search: safe_search as 0 | 1 | 2 | undefined,
    time_range,
    categories,
  });
});

registerTool('image_search', async (args) => {
  const { query, safe_search } = args as { query: string; safe_search?: number };
  const { imageSearch } = await import('../../search/searxng.js');
  return imageSearch(query, { safe_search: safe_search as 0 | 1 | 2 | undefined });
});

registerTool('video_search', async (args) => {
  const { query, safe_search, time_range } = args as {
    query: string;
    safe_search?: number;
    time_range?: string;
  };
  const { videoSearch } = await import('../../search/searxng.js');
  return videoSearch(query, { safe_search: safe_search as 0 | 1 | 2 | undefined, time_range });
});

// ─── 解析 / 格式化 ───────────────────────────────────────────

const TOOL_CALL_REGEX = /<tool_call>\s*([\w_]+)\s*\(([\s\S]*?)\)\s*<\/tool_call>/gi;
const ARG_KEY_REGEX = /(\w+)\s*:\s*(?:'([^']*)'|"([^"]*)"|\[([^\]]*)\]|{([^}]*)}|(\S+))/g;

export function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let match;

  const regex = new RegExp(TOOL_CALL_REGEX.source, 'gi');
  while ((match = regex.exec(text)) !== null) {
    const name = match[1].trim();
    const argsStr = match[2].trim();

    const args: Record<string, unknown> = {};
    const argRegex = new RegExp(ARG_KEY_REGEX.source, 'g');
    let argMatch;

    while ((argMatch = argRegex.exec(argsStr)) !== null) {
      const key = argMatch[1];
      const value = argMatch[2] ?? argMatch[3] ?? argMatch[4] ?? argMatch[5] ?? argMatch[6] ?? '';
      args[key] = value;
    }

    calls.push({ name, args });
  }

  return calls;
}

export function stripToolCalls(text: string): string {
  return text.replace(/<tool_call>\s*[\w_]+\s*\([\s\S]*?\)\s*<\/tool_call>/gi, '').trim();
}

export function formatToolResults(results: ToolResult[]): string {
  if (results.length === 0) return '';
  return results
    .map((r) => {
      if (r.success) {
        return `[${r.name}] OK: ${JSON.stringify(r.result)}`;
      } else {
        return `[${r.name}] ERROR: ${r.error}`;
      }
    })
    .join('\n');
}

export function buildToolCall(name: string, args: Record<string, unknown>): string {
  const argsStr = Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v}'` : JSON.stringify(v)}`)
    .join(', ');
  return `<tool_call>\n${name}(${argsStr})\n</tool_call>`;
}

// ─── 执行 ───────────────────────────────────────────────────

export async function executeToolCall(call: ToolCall): Promise<ToolResult> {
  const fn = toolRegistry.get(call.name);
  if (!fn) {
    return { name: call.name, success: false, result: null, error: `Unknown tool: ${call.name}` };
  }

  try {
    const result = await fn(call.args);
    return { name: call.name, success: true, result };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { name: call.name, success: false, result: null, error };
  }
}

export async function executeToolCalls(calls: ToolCall[]): Promise<ToolResult[]> {
  return Promise.all(calls.map(executeToolCall));
}

export function listTools(): string[] {
  return Array.from(toolRegistry.keys());
}

export function isToolAllowed(_subAgentId: string, _toolName: string): boolean {
  // Parent agent can use all tools
  if (_subAgentId === '__parent__') return true;
  // For sub-agents, delegate to sub-agents module
  return true;
}
