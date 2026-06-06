import type { CharterGuard } from '@colomind/sentinel'
import type { Middleware, GatewayRequest, GatewayResponse } from '../types.js'

export function createCharterCheckMiddleware(charterGuard?: CharterGuard): Middleware {
  return async (req: GatewayRequest, next: () => Promise<GatewayResponse>): Promise<GatewayResponse> => {
    if (!charterGuard) {
      return next()
    }

    if (req.path.startsWith('/api/tools/execute') && req.method === 'POST') {
      const body = req.body as { tool?: string; toolName?: string }
      const toolName = body?.tool || body?.toolName

      if (toolName) {
        const userId = req.context.userId || 'default'
        const checkResult = charterGuard.checkTool(userId, toolName)
        req.context.charterResult = checkResult

        if (!checkResult.allowed) {
          return {
            status: 403,
            body: {
              error: 'Tool not allowed by Charter',
              reason: checkResult.reason,
              charter: checkResult.charter,
            },
          }
        }
      }
    }

    return next()
  }
}
