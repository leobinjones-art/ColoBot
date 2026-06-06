import crypto from 'crypto'
import type { Database } from 'better-sqlite3'
import type { Middleware, GatewayRequest, GatewayResponse, GatewayConfig, DeviceInfo } from '../types.js'

interface DeviceRow {
  id: string
  api_key_hash: string
  device_id: string
  device_token: string
  platform: string
  user_agent: string
  bound_at: number
  last_seen: number
  expires_at: number
}

function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}

function generateDeviceToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function createDeviceAuthMiddleware(db: Database, config: GatewayConfig): Middleware {
  const getActiveBinding = db.prepare(`
    SELECT * FROM device_bindings
    WHERE api_key_hash = ? AND device_id = ? AND expires_at > ?
  `)
  const getAnyBinding = db.prepare(`
    SELECT * FROM device_bindings
    WHERE api_key_hash = ? AND device_id = ?
    ORDER BY expires_at DESC LIMIT 1
  `)
  const countActiveDevices = db.prepare(`
    SELECT COUNT(*) as count FROM device_bindings WHERE api_key_hash = ? AND expires_at > ?
  `)
  const insertBinding = db.prepare(`
    INSERT INTO device_bindings
    (id, api_key_hash, device_id, device_token, platform, user_agent, bound_at, last_seen, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const updateLastSeen = db.prepare(`
    UPDATE device_bindings SET last_seen = ? WHERE id = ?
  `)
  const deleteBinding = db.prepare(`
    DELETE FROM device_bindings WHERE id = ?
  `)

  return async (req: GatewayRequest, next: () => Promise<GatewayResponse>): Promise<GatewayResponse> => {
    const apiKey = req.context.apiKey
    if (!apiKey) {
      return next()
    }

    const deviceId = req.headers['x-device-id']
    const deviceToken = req.headers['x-device-token']
    const platform = req.headers['x-platform'] || 'unknown'
    const userAgent = req.headers['user-agent'] || ''

    if (!deviceId) {
      return { status: 400, body: { error: 'Missing X-Device-Id header' } }
    }

    const apiKeyHash = hashApiKey(apiKey)
    const now = Date.now()

    // Case 1: Client provides a token
    if (deviceToken) {
      const row = getActiveBinding.get(apiKeyHash, deviceId, now) as DeviceRow | undefined
      if (row && row.device_token === deviceToken) {
        updateLastSeen.run(now, row.id)
        req.context.device = {
          deviceId,
          platform: row.platform,
          userAgent: row.user_agent,
          deviceToken,
        }
        return next()
      }

      // Token expired or invalid — check if there's an expired binding we can renew
      const expiredRow = getAnyBinding.get(apiKeyHash, deviceId) as DeviceRow | undefined
      if (expiredRow && expiredRow.device_token === deviceToken && expiredRow.expires_at <= now) {
        // Token matches but expired — delete old and allow rebinding
        deleteBinding.run(expiredRow.id)
        // Fall through to rebinding below
      } else {
        return { status: 401, body: { error: 'Invalid or expired device token', code: 'token_invalid' } }
      }
    }

    // Case 2: No token — first bind or rebinding after expiry
    // Check if already actively bound (client lost token scenario)
    const activeRow = getActiveBinding.get(apiKeyHash, deviceId, now) as DeviceRow | undefined
    if (activeRow) {
      return { status: 401, body: { error: 'Device already bound, provide X-Device-Token', code: 'token_required' } }
    }

    // Clean up any expired binding for this device
    const anyRow = getAnyBinding.get(apiKeyHash, deviceId) as DeviceRow | undefined
    if (anyRow && anyRow.expires_at <= now) {
      deleteBinding.run(anyRow.id)
    }

    const { count } = countActiveDevices.get(apiKeyHash, now) as { count: number }
    if (count >= config.maxDevicesPerKey) {
      return { status: 403, body: { error: 'Maximum devices reached for this API key' } }
    }

    const newToken = generateDeviceToken()
    const id = crypto.randomUUID()
    const expiresAt = now + config.deviceTokenTtlMs

    insertBinding.run(
      id,
      apiKeyHash,
      deviceId,
      newToken,
      platform,
      userAgent,
      now,
      now,
      expiresAt,
    )

    req.context.device = { deviceId, platform, userAgent, deviceToken: newToken }
    const response = await next()
    return {
      ...response,
      headers: { ...response.headers, 'X-Device-Token': newToken, 'X-Device-Expires': String(expiresAt) },
    }
  }
}
