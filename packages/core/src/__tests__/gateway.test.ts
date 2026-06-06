import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { Gateway, DEFAULT_GATEWAY_CONFIG, RATE_LIMIT_PRESETS } from '../gateway/index.js'

describe('Gateway', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
  })

  describe('DEFAULT_GATEWAY_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_GATEWAY_CONFIG.port).toBe(3000)
      expect(DEFAULT_GATEWAY_CONFIG.host).toBe('0.0.0.0')
      expect(DEFAULT_GATEWAY_CONFIG.apiKeys).toEqual([])
      expect(DEFAULT_GATEWAY_CONFIG.maxDevicesPerKey).toBe(3)
      expect(DEFAULT_GATEWAY_CONFIG.rateLimit.windowMs).toBe(60_000)
      expect(DEFAULT_GATEWAY_CONFIG.rateLimit.max).toBe(60)
    })
  })

  describe('RATE_LIMIT_PRESETS', () => {
    it('should define login, chat, and api presets', () => {
      expect(RATE_LIMIT_PRESETS.login.max).toBe(5)
      expect(RATE_LIMIT_PRESETS.chat.max).toBe(30)
      expect(RATE_LIMIT_PRESETS.api.max).toBe(60)
    })
  })

  describe('Gateway constructor', () => {
    it('should initialize with default config', () => {
      const gateway = new Gateway({}, db)
      expect(gateway.getConfig().port).toBe(3000)
      expect(gateway.getDb()).toBe(db)
    })

    it('should override config values', () => {
      const gateway = new Gateway({ port: 8080, apiKeys: ['test-key'] }, db)
      expect(gateway.getConfig().port).toBe(8080)
      expect(gateway.getConfig().apiKeys).toEqual(['test-key'])
    })

    it('should create device_bindings and audit tables', () => {
      new Gateway({}, db)
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
      const tableNames = tables.map(t => t.name)
      expect(tableNames).toContain('device_bindings')
      expect(tableNames).toContain('gateway_audit_logs')
    })
  })

  describe('Gateway.handle', () => {
    it('should return 404 for unmatched routes', async () => {
      const gateway = new Gateway({}, db)
      const result = await gateway.handle({
        path: '/api/nonexistent',
        method: 'GET',
        headers: {},
        body: null,
        query: {},
        context: { channelId: 'http' },
      })
      expect(result.status).toBe(404)
    })
  })

  describe('createHonoApp', () => {
    it('should create a Hono app with health endpoints', () => {
      const gateway = new Gateway({}, db)
      const app = gateway.createHonoApp()
      expect(app).toBeDefined()
    })
  })

  describe('Device Auth', () => {
    it('should bind a new device and return a token', async () => {
      const gateway = new Gateway({ apiKeys: ['test-key'] }, db)
      const result = await gateway.handle({
        path: '/api/chat',
        method: 'POST',
        headers: {
          'x-device-id': 'device-1',
          'x-api-key': 'test-key',
          'x-platform': 'desktop',
        },
        body: { message: 'hello' },
        query: {},
        context: { channelId: 'http', apiKey: 'test-key' },
      })
      // Device auth middleware should add device token header for new bindings
      expect(result.headers).toHaveProperty('X-Device-Token')
    })

    it('should reject requests with missing device ID when API key is present', async () => {
      const gateway = new Gateway({ apiKeys: ['test-key'] }, db)
      const result = await gateway.handle({
        path: '/api/chat',
        method: 'POST',
        headers: { 'x-api-key': 'test-key' },
        body: {},
        query: {},
        context: { channelId: 'http', apiKey: 'test-key' },
      })
      expect(result.status).toBe(400)
    })
  })

  describe('API Key Auth', () => {
    it('should reject invalid API keys', async () => {
      const gateway = new Gateway({ apiKeys: ['valid-key'] }, db)
      const result = await gateway.handle({
        path: '/api/chat',
        method: 'POST',
        headers: {
          'x-device-id': 'device-1',
          'x-api-key': 'wrong-key',
        },
        body: {},
        query: {},
        context: { channelId: 'http' },
      })
      expect(result.status).toBe(403)
    })

    it('should skip auth when no API keys configured', async () => {
      const gateway = new Gateway({ apiKeys: [] }, db)
      const result = await gateway.handle({
        path: '/api/chat',
        method: 'POST',
        headers: { 'x-device-id': 'device-1' },
        body: {},
        query: {},
        context: { channelId: 'http' },
      })
      // Should not be 401/403
      expect(result.status).not.toBe(401)
      expect(result.status).not.toBe(403)
    })
  })
})
