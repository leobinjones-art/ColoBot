/**
 * 简单内存 Rate Limiter
 * - 按 IP 维度计数
 * - 窗口滑动：60 秒内最多 N 次
 * - 超出返回 429 Too Many Requests
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

// 清理过期条目（每分钟一次）
setInterval(() => {
  const now = Date.now();
  store.forEach((w, key) => {
    if (w.resetAt <= now) store.delete(key);
  });
}, 60_000);

export interface RateLimitConfig {
  windowMs: number;   // 时间窗口（毫秒）
  max: number;        // 窗口内最大请求数
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export const DEFAULTS: Record<string, RateLimitConfig> = {
  login: { windowMs: 60_000, max: 5 },       // /api/login: 60s 内最多 5 次
  api: { windowMs: 60_000, max: 60 },       // 通用 API: 60s 内最多 60 次
  chat: { windowMs: 60_000, max: 30 },       // /api/chat: 60s 内最多 30 次
};

export function checkRateLimit(key: string, config: RateLimitConfig = DEFAULTS.api): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // 新窗口
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.max - 1 };
  }

  if (entry.count >= config.max) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: config.max - entry.count };
}

export function getClientIP(req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return String(forwarded[0]).split(',')[0].trim();
  return req.socket.remoteAddress?.replace('::ffff:', '') || 'unknown';
}

/**
 * 生成 429 响应的辅助
 */
export function rateLimitResponse(retryAfterMs: number): { status: number; headers: Record<string, string>; body: string } {
  const retrySec = Math.ceil(retryAfterMs / 1000);
  return {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retrySec),
      'X-RateLimit-Remaining': '0',
    },
    body: JSON.stringify({ error: 'Too Many Requests', retryAfter: `${retrySec}s` }),
  };
}
