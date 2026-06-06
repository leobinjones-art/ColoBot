import type { SentinelConfig } from '@colomind/sentinel'

export interface GatewayConfig {
  port: number
  host: string
  apiKeys: string[]
  maxDevicesPerKey: number
  deviceTokenTtlMs: number
  rateLimit: {
    windowMs: number
    max: number
  }
  cors: {
    origin: string | string[]
    credentials: boolean
  }
  sentinel?: SentinelConfig
}

export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  port: 3000,
  host: '0.0.0.0',
  apiKeys: [],
  maxDevicesPerKey: 3,
  deviceTokenTtlMs: 30 * 24 * 3600 * 1000,
  rateLimit: { windowMs: 60_000, max: 60 },
  cors: { origin: '*', credentials: true },
}

export interface DeviceInfo {
  deviceId: string
  platform: string
  userAgent: string
  deviceToken?: string
}

export interface DeviceBinding {
  id: string
  apiKeyHash: string
  deviceId: string
  deviceToken: string
  platform: string
  userAgent: string
  boundAt: number
  lastSeen: number
  expiresAt: number
}

export interface GatewayContext {
  channelId: string
  sessionId?: string
  userId?: string
  apiKey?: string
  device?: DeviceInfo
  clientIp?: string
  sentinelResult?: unknown
  charterResult?: unknown
  auditId?: string
}

export interface GatewayRequest {
  path: string
  method: string
  headers: Record<string, string>
  body: unknown
  query: Record<string, string>
  context: GatewayContext
}

export interface GatewayResponse {
  status: number
  body: unknown
  headers?: Record<string, string>
}

export type Middleware = (
  req: GatewayRequest,
  next: () => Promise<GatewayResponse>,
) => Promise<GatewayResponse>

export interface RateLimitPreset {
  windowMs: number
  max: number
}

export const RATE_LIMIT_PRESETS: Record<string, RateLimitPreset> = {
  login: { windowMs: 60_000, max: 5 },
  chat: { windowMs: 60_000, max: 30 },
  api: { windowMs: 60_000, max: 60 },
}
