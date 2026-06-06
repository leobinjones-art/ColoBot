import type { Middleware, GatewayRequest, GatewayResponse, GatewayConfig } from '../types.js'

export function createApiAuthMiddleware(config: GatewayConfig): Middleware {
  return async (req: GatewayRequest, next: () => Promise<GatewayResponse>): Promise<GatewayResponse> => {
    if (config.apiKeys.length === 0) {
      return next()
    }

    const authHeader = req.headers['authorization'] || ''
    const headerKey = req.headers['x-api-key'] || ''

    let apiKey = headerKey
    if (!apiKey && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.slice(7)
    }

    if (!apiKey) {
      return { status: 401, body: { error: 'Missing API key' } }
    }

    if (!config.apiKeys.includes(apiKey)) {
      return { status: 403, body: { error: 'Invalid API key' } }
    }

    req.context.apiKey = apiKey
    return next()
  }
}