import crypto from 'crypto'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Database } from 'better-sqlite3'
import { Sentinel, CharterGuard } from '@colomind/sentinel'
import {
  GatewayConfig,
  DEFAULT_GATEWAY_CONFIG,
  Middleware,
  GatewayRequest,
  GatewayResponse,
  GatewayContext,
} from './types.js'
import { createAuditMiddleware } from './middleware/audit.js'
import { createDeviceAuthMiddleware } from './middleware/device-auth.js'
import { createApiAuthMiddleware } from './middleware/api-auth.js'
import { createRateLimitMiddleware } from './middleware/rate-limit.js'
import { createSentinelScanMiddleware } from './middleware/sentinel-scan.js'
import { createCharterCheckMiddleware } from './middleware/charter-check.js'
import { registerRoutes } from './router/index.js'
import { livenessCheck, readinessCheck } from '../health/index.js'

export class Gateway {
  private config: GatewayConfig
  private db: Database
  private sentinel?: Sentinel
  private charterGuard?: CharterGuard
  private middlewares: Middleware[] = []

  constructor(
    config: Partial<GatewayConfig>,
    db: Database,
    sentinel?: Sentinel,
    charterGuard?: CharterGuard,
  ) {
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...config }
    this.db = db
    this.sentinel = sentinel
    this.charterGuard = charterGuard
    this.initTables()
    this.initMiddlewares()
  }

  private initMiddlewares(): void {
    this.middlewares = [
      createAuditMiddleware(this.db),
      createDeviceAuthMiddleware(this.db, this.config),
      createApiAuthMiddleware(this.config),
      createRateLimitMiddleware(this.config),
      createSentinelScanMiddleware(this.sentinel),
      createCharterCheckMiddleware(this.charterGuard),
    ]
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS device_bindings (
        id TEXT PRIMARY KEY,
        api_key_hash TEXT NOT NULL,
        device_id TEXT NOT NULL,
        device_token TEXT NOT NULL,
        platform TEXT,
        user_agent TEXT,
        bound_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_device_bindings_key ON device_bindings(api_key_hash);
      CREATE INDEX IF NOT EXISTS idx_device_bindings_device ON device_bindings(device_id);
    `)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS gateway_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        channel TEXT NOT NULL,
        user_id TEXT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status INTEGER NOT NULL,
        client_ip TEXT,
        sentinel_result TEXT,
        charter_result TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON gateway_audit_logs(timestamp);
    `)
  }

  async handle(req: GatewayRequest): Promise<GatewayResponse> {
    let index = 0
    const dispatch = async (): Promise<GatewayResponse> => {
      if (index >= this.middlewares.length) {
        return { status: 404, body: { error: 'Not found' } }
      }
      const mw = this.middlewares[index]
      index++
      return mw(req, dispatch)
    }
    return dispatch()
  }

  createHonoApp(): Hono {
    const app = new Hono()

    app.use('*', cors({
      origin: this.config.cors.origin,
      credentials: this.config.cors.credentials,
    }))

    app.get('/healthz', async (c) => c.json(livenessCheck()))
    app.get('/livez', async (c) => c.json(livenessCheck()))
    app.get('/readyz', async (c) => c.json(await readinessCheck()))

    app.route('/api', registerRoutes(this))

    return app
  }

  getConfig(): GatewayConfig {
    return this.config
  }

  getDb(): Database {
    return this.db
  }

  getSentinel(): Sentinel | undefined {
    return this.sentinel
  }

  getCharterGuard(): CharterGuard | undefined {
    return this.charterGuard
  }

  getMiddlewares(): Middleware[] {
    return [...this.middlewares]
  }

  bindDevice(apiKey: string, deviceId: string, platform: string, userAgent: string): { deviceToken: string; expiresAt: number } | { error: string; code: string } {
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
    const now = Date.now()

    const getActive = this.db.prepare('SELECT id FROM device_bindings WHERE api_key_hash = ? AND device_id = ? AND expires_at > ?')
    const countActive = this.db.prepare('SELECT COUNT(*) as count FROM device_bindings WHERE api_key_hash = ? AND expires_at > ?')
    const insert = this.db.prepare('INSERT INTO device_bindings (id, api_key_hash, device_id, device_token, platform, user_agent, bound_at, last_seen, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')

    if (getActive.get(apiKeyHash, deviceId, now)) {
      return { error: 'Device already bound', code: 'token_required' }
    }

    const { count } = countActive.get(apiKeyHash, now) as { count: number }
    if (count >= this.config.maxDevicesPerKey) {
      return { error: 'Maximum devices reached for this API key', code: 'max_devices' }
    }

    const newToken = crypto.randomBytes(32).toString('hex')
    const id = crypto.randomUUID()
    const expiresAt = now + this.config.deviceTokenTtlMs

    insert.run(id, apiKeyHash, deviceId, newToken, platform, userAgent, now, now, expiresAt)
    return { deviceToken: newToken, expiresAt }
  }

  unbindDevice(apiKey: string, deviceId: string): boolean {
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
    const result = this.db.prepare('DELETE FROM device_bindings WHERE api_key_hash = ? AND device_id = ?').run(apiKeyHash, deviceId)
    return result.changes > 0
  }
}
