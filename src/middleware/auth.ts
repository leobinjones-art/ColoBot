/**
 * 认证中间件 - API Key 验证
 *
 * 优先级：
 * 1. 启动参数 --api-keys "k1,k2"
 * 2. 交互式输入（启动时未提供参数）
 * 3. 未配置 → 开发模式（跳过验证）
 */

import * as readline from 'readline';

let apiKeys: Set<string> = new Set();
let configured = false;

/**
 * 解析启动参数 --api-keys "k1,k2"
 */
function parseCliArgs(): string[] {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === '--api-keys' || args[i] === '--api-key') {
      return args[i + 1].split(',').map(k => k.trim()).filter(Boolean);
    }
  }
  // 也支持 --api-keys="k1,k2" 格式
  for (const arg of args) {
    if (arg.startsWith('--api-keys=') || arg.startsWith('--api-key=')) {
      return arg.split('=')[1].split(',').map(k => k.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * 设置 API Keys（供交互式或程序化调用）
 */
export function setApiKeys(keys: string[]): void {
  apiKeys = new Set(keys.filter(Boolean));
  configured = true;
}

/**
 * 是否已配置（无论是否设置了 key）
 */
export function isAuthConfigured(): boolean {
  return configured;
}

/**
 * 是否有 key（已配置且非空）
 */
export function hasKeys(): boolean {
  return apiKeys.size > 0;
}

/**
 * 验证 API Key 是否有效
 */
export function validateKey(key: string): boolean {
  if (!configured || apiKeys.size === 0) return true; // 未配置则直接通过
  return apiKeys.has(key);
}

/**
 * 初始化认证：解析 CLI 参数、环境变量或交互式输入
 */
export async function initAuth(): Promise<void> {
  const cliKeys = parseCliArgs();
  if (cliKeys.length > 0) {
    setApiKeys(cliKeys);
    console.log(`[Auth] API Keys loaded from CLI args (${apiKeys.size})`);
    return;
  }

  // 从环境变量加载
  const envKey = process.env.COLOBOT_API_KEY;
  if (envKey && envKey.trim()) {
    setApiKeys([envKey.trim()]);
    console.log('[Auth] API Key loaded from COLOBOT_API_KEY env');
    return;
  }

  configured = true;

  // 非 TTY 环境（如 systemd 后台进程）跳过交互式输入
  if (!process.stdin.isTTY) {
    console.log('[Auth] 非交互模式，未设置 API Keys（跳过认证）');
    return;
  }

  // 交互式输入
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('[Auth] 请输入 API Keys（逗号分隔，留空跳过）: ', (answer) => {
      rl.close();
      const keys = answer.split(',').map(k => k.trim()).filter(Boolean);
      if (keys.length > 0) {
        setApiKeys(keys);
        console.log(`[Auth] API Keys 已设置 (${apiKeys.size} 个)`);
      } else {
        console.log('[Auth] 未设置 API Keys，开发模式（跳过认证）');
      }
      resolve();
    });
  });
}

export interface AuthContext {
  apiKey?: string;
  authenticated: boolean;
}

function extractApiKey(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const auth = req.headers['authorization'] || req.headers['x-api-key'];
  if (!auth) return undefined;
  if (Array.isArray(auth)) return String(auth[0]);
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return auth;
}

function validateApiKey(key: string | undefined): AuthContext {
  if (!configured || apiKeys.size === 0) {
    // 未配置，开发模式
    return { apiKey: key, authenticated: true };
  }
  if (!key) return { authenticated: false };
  return { apiKey: key, authenticated: apiKeys.has(key) };
}

export function requireAuth(req: { headers: Record<string, string | string[] | undefined> }): AuthContext {
  const key = extractApiKey(req);
  const ctx = validateApiKey(key);
  if (!ctx.authenticated) {
    const err = new Error('Unauthorized: Invalid or missing API key');
    (err as any).status = 401;
    throw err;
  }
  return ctx;
}
