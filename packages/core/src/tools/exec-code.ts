/**
 * 代码执行工具 - 沙箱内执行 Node.js 代码
 */

import vm from 'vm';
import type { ToolContext } from '@colobot/types';
import { toolRegistry } from './registry.js';

async function execCode(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const { code, timeout_ms } = args as { code: string; timeout_ms?: number };

  if (!code) throw new Error('code is required');

  const timeout = Math.min(Math.max(timeout_ms || 5000, 100), 30_000);

  const output: string[] = [];

  const sandbox = {
    console: {
      log: (...args: unknown[]) => { output.push(args.map(String).join(' ')); },
      error: (...args: unknown[]) => { output.push('[error] ' + args.map(String).join(' ')); },
      warn: (...args: unknown[]) => { output.push('[warn] ' + args.map(String).join(' ')); },
      info: (...args: unknown[]) => { output.push('[info] ' + args.map(String).join(' ')); },
    },
    result: undefined,
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
  };

  const context = vm.createContext(sandbox);

  try {
    const script = new vm.Script(code, { filename: 'exec.js' });
    script.runInContext(context, { timeout });
  } catch (e: any) {
    if (e.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
      throw new Error(`Execution timed out after ${timeout}ms`);
    }
    throw new Error(`Execution error: ${e.message}`);
  }

  const result = sandbox.result !== undefined
    ? JSON.stringify(sandbox.result)
    : (output.length > 0 ? output.join('\n') : 'undefined');

  return JSON.stringify({ ok: true, result, output, timeoutMs: timeout });
}

export function registerExecCodeTool(): void {
  toolRegistry.register({
    name: 'exec_code',
    description: 'Execute Node.js code in a sandboxed environment',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code to execute' },
        timeout_ms: { type: 'number', description: 'Execution timeout in milliseconds (default: 5000, max: 30000)' },
      },
      required: ['code'],
    },
    execute: execCode,
  });
}
