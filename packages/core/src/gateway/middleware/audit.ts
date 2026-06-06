import type { Database } from 'better-sqlite3'
import type { Middleware, GatewayRequest, GatewayResponse } from '../types.js'

export function createAuditMiddleware(db: Database): Middleware {
  const insertLog = db.prepare(`
    INSERT INTO gateway_audit_logs
    (timestamp, channel, user_id, method, path, status, client_ip, sentinel_result, charter_result)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  return async (req: GatewayRequest, next: () => Promise<GatewayResponse>): Promise<GatewayResponse> => {
    const startTime = Date.now()
    const response = await next()
    const duration = Date.now() - startTime

    insertLog.run(
      startTime,
      req.context.channelId,
      req.context.userId ?? null,
      req.method,
      req.path,
      response.status,
      req.context.clientIp ?? null,
      req.context.sentinelResult ? JSON.stringify(req.context.sentinelResult) : null,
      req.context.charterResult ? JSON.stringify(req.context.charterResult) : null,
    )

    return response
  }
}
