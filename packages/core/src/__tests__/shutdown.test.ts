import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GracefulShutdown, createGracefulShutdown } from '../index.js'

describe('GracefulShutdown', () => {
  let shutdown: GracefulShutdown

  it('should create instance with default options', () => {
    shutdown = new GracefulShutdown()
    expect(shutdown.isShutting()).toBe(false)
  })

  it('should create instance with createGracefulShutdown', () => {
    shutdown = createGracefulShutdown({ timeout: 10000 })
    expect(shutdown).toBeInstanceOf(GracefulShutdown)
  })

  it('should track isShutting state', () => {
    shutdown = new GracefulShutdown()

    // Access private method via any
    ;(shutdown as any).isShuttingDown = true
    expect(shutdown.isShutting()).toBe(true)
  })

  it('should track connections', () => {
    shutdown = new GracefulShutdown()

    const conn = { on: vi.fn() }
    shutdown.trackConnection(conn)

    expect(shutdown.getActiveConnections()).toBe(1)

    // Simulate connection close
    const closeCallback = conn.on.mock.calls.find((call: any[]) => call[0] === 'close')?.[1]
    if (closeCallback) closeCallback()

    expect(shutdown.getActiveConnections()).toBe(0)
  })
})
