/**
 * 工具执行器 - 解析、执行工具调用
 */

import type { ToolContext } from '@colobot/types';
import { toolRegistry } from './registry.js';

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  success: boolean;
  result: unknown;
  error?: string;
  blocked?: boolean;
  reason?: string;
}

export interface ToolPolicy {
  check_fn?: (args: Record<string, unknown>, ctx: ToolContext) => Promise<'allowed' | 'denied'>;
  required_role?: 'admin' | 'developer' | 'readonly';
  require_approval?: boolean;
}

const toolPolicies = new Map<string, ToolPolicy>();

export function registerToolPolicy(name: string, policy: ToolPolicy): void {
  toolPolicies.set(name, policy);
}

export function getToolPolicy(name: string): ToolPolicy | undefined {
  return toolPolicies.get(name);
}

// ─── 解析 ───────────────────────────────────────────────────

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
    .map(([k, v]) => {
      if (typeof v === 'string') return `${k}: '${v}'`;
      return `${k}: ${JSON.stringify(v)}`;
    })
    .join(', ');
  return `<tool_call>\n${name}(${argsStr})\n<\/tool_call>`;
}

// ─── 执行 ───────────────────────────────────────────────────

export async function executeToolCall(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
  const tool = toolRegistry.get(call.name);
  if (!tool) {
    return { name: call.name, success: false, result: null, error: `Tool not found: ${call.name}` };
  }

  const policy = toolPolicies.get(call.name);
  if (policy) {
    if (policy.required_role && ctx.userRole) {
      const roleOrder = ['readonly', 'developer', 'admin'];
      const userLevel = roleOrder.indexOf(ctx.userRole);
      const requiredLevel = roleOrder.indexOf(policy.required_role);
      if (userLevel > requiredLevel) {
        return { name: call.name, success: false, result: null, error: `Insufficient role: need ${policy.required_role}`, blocked: true };
      }
    }

    if (policy.check_fn) {
      try {
        const decision = await policy.check_fn(call.args, ctx);
        if (decision === 'denied') {
          return { name: call.name, success: false, result: null, error: 'Denied by policy check', blocked: true };
        }
      } catch (e) {
        return { name: call.name, success: false, result: null, error: `Policy check error: ${e}`, blocked: true };
      }
    }
  }

  try {
    const result = await tool.execute(call.args, ctx);
    return { name: call.name, success: true, result };
  } catch (err) {
    return { name: call.name, success: false, result: null, error: String(err) };
  }
}

export async function executeToolCalls(calls: ToolCall[], ctx: ToolContext): Promise<ToolResult[]> {
  return Promise.all(calls.map(c => executeToolCall(c, ctx)));
}

export function needsApproval(call: ToolCall): boolean {
  const policy = toolPolicies.get(call.name);
  return policy?.require_approval ?? false;
}

export function listTools(): string[] {
  return toolRegistry.list().map(t => t.name);
}
