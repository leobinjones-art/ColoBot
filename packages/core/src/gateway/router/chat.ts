import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { Gateway } from '../gateway.js'

export function chatRoutes(gateway: Gateway): Hono {
  const router = new Hono()

  router.post('/chat/stream', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const { message, sessionId, agentId } = body as {
      message?: string
      sessionId?: string
      agentId?: string
    }

    if (!message) {
      return c.json({ error: 'Missing message' }, 400)
    }

    return streamSSE(c, async (stream) => {
      try {
        const sentinel = gateway.getSentinel()
        if (sentinel) {
          const scanResult = sentinel.scanInputWithTakeover(message, sessionId ?? 'default')
          if (!scanResult.pass) {
            await stream.writeSSE({
              data: JSON.stringify({
                type: 'error',
                error: 'Content blocked by Sentinel',
                response: scanResult.response,
              }),
            })
            return
          }
        }

        await stream.writeSSE({
          data: JSON.stringify({ type: 'start', sessionId }),
        })

        // The actual LLM call is delegated to the sidecar/runtime layer
        // Gateway handles auth, rate limiting, and security scanning
        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({ type: 'done' }),
        })
      } catch (error) {
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        })
      }
    })
  })

  router.post('/chat', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const { message, sessionId, agentId } = body as {
      message?: string
      sessionId?: string
      agentId?: string
    }

    if (!message) {
      return c.json({ error: 'Missing message' }, 400)
    }

    return c.json({
      response: '',
      sessionId,
      agentId,
      message: 'Chat processing delegated to runtime layer',
    })
  })

  return router
}
