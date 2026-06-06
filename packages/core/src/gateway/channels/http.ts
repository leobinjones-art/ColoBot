import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import type { Server } from 'http'
import type { Gateway } from '../gateway.js'

export function createHonoApp(gateway: Gateway): { app: Hono; start: () => Server } {
  const app = gateway.createHonoApp()
  const config = gateway.getConfig()

  const start = (): Server => {
    return serve({ fetch: app.fetch, port: config.port, hostname: config.host }) as Server
  }

  return { app, start }
}