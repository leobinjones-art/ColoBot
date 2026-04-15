/**
 * 工具执行器 - 解析、执行工具调用
 *
 * 所有工具按模态拆分到子模块，入口文件仅保留注册机制和解析工具
 */

// Re-export shared types
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

export function registerTool(name: string, fn: (args: Record<string, unknown>) => Promise<unknown>): void {
  toolRegistry.set(name, fn);
}

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
    .map(([k, v]) => {
      if (typeof v === 'string') return `${k}: '${v}'`;
      return `${k}: ${JSON.stringify(v)}`;
    })
    .join(', ');
  return `<tool_call>\n${name}(${argsStr})\n</tool_call>`;
}

// ─── 执行 ───────────────────────────────────────────────────

export async function executeToolCall(call: ToolCall): Promise<ToolResult> {
  const fn = toolRegistry.get(call.name);
  if (!fn) {
    return { name: call.name, success: false, result: null, error: `Tool not found: ${call.name}` };
  }
  try {
    const result = await fn(call.args);
    return { name: call.name, success: true, result };
  } catch (err) {
    return { name: call.name, success: false, result: null, error: String(err) };
  }
}

export async function executeToolCalls(calls: ToolCall[]): Promise<ToolResult[]> {
  return Promise.all(calls.map(executeToolCall));
}

export function listTools(): string[] {
  return Array.from(toolRegistry.keys());
}

export function isToolAllowed(_subAgentId: string, _toolName: string): boolean {
  // Stub: all tools allowed for __parent__, sub-agents handle restrictions via sub-agents module
  return true;
}

// ─── 加载所有工具模块 ─────────────────────────────────────────

import { registerTools as registerMemoryTools } from './memory.js';
import { registerTools as registerSubagentTools } from './subagent.js';
import { registerTools as registerWebSearchTools } from './web-search.js';
import { registerTools as registerMinimaxTextTools } from './minimax-text.js';
import { registerTools as registerMinimaxSearchTools } from './minimax-search.js';
import { registerTools as registerMinimaxTtsTools } from './minimax-tts.js';
import { registerTools as registerMinimaxMusicTools } from './minimax-music.js';
import { registerTools as registerMinimaxVideoTools } from './minimax-video.js';
import { registerTools as registerMinimaxFileTools } from './minimax-file.js';
import { registerTools as registerMinimaxVoiceTools } from './minimax-voice.js';

registerMemoryTools();
registerSubagentTools();
registerWebSearchTools();
registerMinimaxTextTools();
registerMinimaxSearchTools();
registerMinimaxTtsTools();
registerMinimaxMusicTools();
registerMinimaxVideoTools();
registerMinimaxFileTools();
registerMinimaxVoiceTools();
