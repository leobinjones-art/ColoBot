import { Hono } from 'hono'
import type { Gateway } from '../gateway.js'

export function sentinelRoutes(gateway: Gateway): Hono {
  const router = new Hono()

  router.post('/sentinel/scan', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const { text, sessionId } = body as { text?: string; sessionId?: string }

    if (!text) {
      return c.json({ error: 'Missing text' }, 400)
    }

    const sentinel = gateway.getSentinel()
    if (!sentinel) {
      return c.json({ error: 'Sentinel not available' }, 503)
    }

    const result = sentinel.scanInputWithTakeover(text, sessionId ?? 'default')
    return c.json(result)
  })

  router.get('/sentinel/status', (c) => {
    const sentinel = gateway.getSentinel()
    if (!sentinel) {
      return c.json({ available: false })
    }
    return c.json({
      available: true,
      status: 'active',
      layers: ['L1: RuleEngine', 'L1.5: LocalIntent', 'L2: InferenceAgent', 'L3: LegalGuidance'],
    })
  })

  router.get('/sentinel/stats', (c) => {
    return c.json({ scans: 0, blocked: 0, takeover: 0 })
  })

  router.get('/sentinel/logs', (c) => {
    return c.json({ logs: [] })
  })

  return router
}
