/**
 * 认证中间件 - API Key 验证
 */

const API_KEYS = new Set<string>(
  (process.env.API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean)
);

export interface AuthContext {
  apiKey?: string;
  authenticated: boolean;
}

/**
 * 从请求中提取 API Key
 */
export function extractApiKey(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const auth = req.headers['authorization'] || req.headers['x-api-key'];
  if (!auth) return undefined;
  if (Array.isArray(auth)) return String(auth[0]);
  // 支持 "Bearer <key>" 格式
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return auth;
}

/**
 * 验证 API Key
 */
export function validateApiKey(key: string | undefined): AuthContext {
  if (API_KEYS.size === 0) {
    // 未配置 API Keys时不验证（开发模式）
    return { apiKey: key, authenticated: true };
  }
  if (!key) return { authenticated: false };
  return { apiKey: key, authenticated: API_KEYS.has(key) };
}

/**
 * 认证中间件工厂
 * 返回是否通过认证，未通过时抛出错误
 */
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
