import { Hono } from 'hono'
import type { Gateway } from '../gateway.js'
import { agentRoutes } from './agents.js'
import { chatRoutes } from './chat.js'
import { sentinelRoutes } from './sentinel.js'
import { settingsRoutes } from './settings.js'

export function registerRoutes(gateway: Gateway): Hono {
  const api = new Hono()

  api.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }))

  api.route('/', chatRoutes(gateway))
  api.route('/', agentRoutes(gateway))
  api.route('/', sentinelRoutes(gateway))
  api.route('/', settingsRoutes(gateway))

  return api
}
