/**
 * 危险工具：exec_code - 沙箱内执行 Node.js 代码
 *
 * 使用 vm + timeout 限制，防止恶意长时间运行
 * 需要审批（action_type: exec）
 */

import vm from 'vm';
import { registerTool } from './executor.js';

function register() {
  registerTool('exec_code', async (args) => {
    const {
      code,
      timeout_ms = 5000,
    } = args as {
      code: string;
      timeout_ms?: number;
    };

    if (!code) throw new Error('code is required');

    const timeout = Math.min(Math.max(timeout_ms, 100), 30_000);

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
    } catch (e) {
      const err = e as { message?: string; code?: string };
      if (err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        throw new Error(`Execution timed out after ${timeout}ms`, { cause: e });
      }
      throw new Error(`Execution error: ${err.message}`, { cause: e });
    }

    const result = sandbox.result !== undefined
      ? JSON.stringify(sandbox.result)
      : (output.length > 0 ? output.join('\n') : 'undefined');

    return {
      ok: true,
      result,
      output,
      timeoutMs: timeout,
    };
  });
}

export function registerTools(): void {
  register();
}
