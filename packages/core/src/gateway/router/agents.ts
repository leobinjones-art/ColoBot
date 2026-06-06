import { Hono } from 'hono'
import type { Gateway } from '../gateway.js'

export function agentRoutes(gateway: Gateway): Hono {
  const router = new Hono()

  router.get('/agents', (c) => c.json({ agents: [], message: 'Delegate to agent registry' }))

  router.post('/agents', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    return c.json({ agent: body, message: 'Delegate to agent registry' }, 201)
  })

  router.get('/agents/:id', (c) => {
    const id = c.req.param('id')
    return c.json({ agent: { id }, message: 'Delegate to agent registry' })
  })

  router.put('/agents/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    return c.json({ agent: { id, ...body }, message: 'Delegate to agent registry' })
  })

  router.delete('/agents/:id', (c) => {
    const id = c.req.param('id')
    return c.json({ deleted: id, message: 'Delegate to agent registry' })
  })

  router.post('/agents/:id/start', (c) => {
    const id = c.req.param('id')
    return c.json({ agentId: id, status: 'active' })
  })

  router.post('/agents/:id/stop', (c) => {
    const id = c.req.param('id')
    return c.json({ agentId: id, status: 'stopped' })
  })

  return router
}
