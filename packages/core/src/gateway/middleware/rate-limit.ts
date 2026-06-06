import type { Middleware, GatewayRequest, GatewayResponse, GatewayConfig } from '../types.js'

interface RateLimitEntry {
  timestamps: number[]
}

const MAX_ENTRIES = 10000
const rateLimitStore = new Map<string, RateLimitEntry>()
let cleanupHandle: ReturnType<typeof setInterval> | null = null

function cleanupExpired(windowMs: number): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs)
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key)
    }
  }
  if (rateLimitStore.size > MAX_ENTRIES) {
    const keys = [...rateLimitStore.keys()]
    const excess = keys.length - MAX_ENTRIES
    for (let i = 0; i < excess; i++) {
      rateLimitStore.delete(keys[i])
    }
  }
}

export function createRateLimitMiddleware(config: GatewayConfig): Middleware {
  const windowMs = config.rateLimit.windowMs
  const max = config.rateLimit.max

  if (!cleanupHandle) {
    cleanupHandle = setInterval(() => cleanupExpired(windowMs), 60_000)
    if (cleanupHandle.unref) cleanupHandle.unref()
  }

  return async (req: GatewayRequest, next: () => Promise<GatewayResponse>): Promise<GatewayResponse> => {
    const key = `${req.context.clientIp ?? 'unknown'}:${req.context.apiKey ?? 'anonymous'}`
    const now = Date.now()

    let entry = rateLimitStore.get(key)
    if (!entry) {
      entry = { timestamps: [] }
      rateLimitStore.set(key, entry)
    }

    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs)

    if (entry.timestamps.length >= max) {
      const oldestInWindow = entry.timestamps[0]
      const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000)
      return {
        status: 429,
        body: { error: 'Too many requests' },
        headers: { 'Retry-After': String(Math.max(1, retryAfter)) },
      }
    }

    entry.timestamps.push(now)
    return next()
  }
}

export function stopRateLimitCleanup(): void {
  if (cleanupHandle) {
    clearInterval(cleanupHandle)
    cleanupHandle = null
  }
}
