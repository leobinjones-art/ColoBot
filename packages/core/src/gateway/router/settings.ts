import { Hono } from 'hono'
import type { Gateway } from '../gateway.js'

export function settingsRoutes(gateway: Gateway): Hono {
  const router = new Hono()

  router.get('/settings', (c) => {
    return c.json({ settings: {}, message: 'Delegate to config manager' })
  })

  router.put('/settings', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    return c.json({ settings: body, message: 'Delegate to config manager' })
  })

  router.get('/charters', (c) => {
    return c.json({ charters: [], message: 'Delegate to charter manager' })
  })

  router.get('/charters/builtin-types', (c) => {
    return c.json({ types: ['academic', 'legal', 'longdoc'] })
  })

  router.get('/charters/types', (c) => {
    return c.json({ types: ['academic', 'legal', 'longdoc'] })
  })

  router.get('/libraries', (c) => {
    return c.json({ libraries: [] })
  })

  router.get('/skills', (c) => {
    return c.json({ skills: [] })
  })

  router.get('/tools', (c) => {
    return c.json({ tools: [] })
  })

  return router
}
