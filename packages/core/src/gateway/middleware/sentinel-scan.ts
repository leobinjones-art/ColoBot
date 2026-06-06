import type { Sentinel } from '@colomind/sentinel'
import type { Middleware, GatewayRequest, GatewayResponse } from '../types.js'

export function createSentinelScanMiddleware(sentinel?: Sentinel): Middleware {
  return async (req: GatewayRequest, next: () => Promise<GatewayResponse>): Promise<GatewayResponse> => {
    if (!sentinel) {
      return next()
    }

    if (req.path.startsWith('/api/chat') && req.method === 'POST') {
      const body = req.body as { message?: string; messages?: unknown[] }
      const messageText = typeof body?.message === 'string'
        ? body.message
        : body?.messages
          ? JSON.stringify(body.messages)
          : ''

      if (messageText) {
        const scanResult = sentinel.scanInputWithTakeover(messageText, req.context.sessionId ?? 'default')
        req.context.sentinelResult = scanResult

        if (!scanResult.pass) {
          return {
            status: 403,
            body: {
              error: 'Content blocked by Sentinel',
              response: scanResult.response,
            },
          }
        }
      }
    }

    const response = await next()

    if (req.path.startsWith('/api/chat') && response.status === 200) {
      const body = response.body as { response?: string; content?: string }
      const responseText = typeof body?.response === 'string'
        ? body.response
        : typeof body?.content === 'string'
          ? body.content
          : ''

      if (responseText) {
        const outputScan = sentinel.scanOutput(responseText)
        if (!outputScan.pass) {
          return {
            status: 403,
            body: {
              error: 'Output blocked by Sentinel',
              reason: outputScan.reason,
              matched: outputScan.matched,
            },
          }
        }
      }
    }

    return response
  }
}
