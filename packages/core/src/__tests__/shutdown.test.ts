/**
 * Shutdown Module Tests - Real EventEmitter-based connection tracking
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { EventEmitter } from 'events'
import { GracefulShutdown, createGracefulShutdown } from '../shutdown/index.js'

/**
 * Create a real EventEmitter-based connection that tracks events.
 * This replaces vi.fn() callbacks with manual call tracking arrays.
 */
function createTrackedConnection(): {
  conn: EventEmitter & { close: () => void; destroy: () => void }
  closeCalls: string[]
  destroyCalls: string[]
  errorCalls: Array<{ event: string; err: Error }>
  endCalls: string[]
} {
  const closeCalls: string[] = []
  const destroyCalls: string[] = []
  const errorCalls: Array<{ event: string; err: Error }> = []
  const endCalls: string[] = []

  const conn = Object.assign(new EventEmitter(), {
    close() {
      closeCalls.push('close')
      conn.emit('close')
    },
    destroy() {
      destroyCalls.push('destroy')
      conn.emit('close')
    },
  })

  // Track errors
  conn.on('error', (err: Error) => {
    errorCalls.push({ event: 'error', err })
  })

  // Track ends
  conn.on('end', () => {
    endCalls.push('end')
  })

  return { conn, closeCalls, destroyCalls, errorCalls, endCalls }
}

describe('GracefulShutdown', () => {
  // Use a single shutdown instance to avoid repeatedly registering signal handlers
  let shutdown: GracefulShutdown

  beforeAll(() => {
    shutdown = new GracefulShutdown()
  })

  describe('instance creation', () => {
    it('should create instance with default options', () => {
      expect(shutdown).toBeInstanceOf(GracefulShutdown)
      expect(shutdown.isShutting()).toBe(false)
    })

    it('should create instance with createGracefulShutdown', () => {
      const instance = createGracefulShutdown({ timeout: 10000 })
      expect(instance).toBeInstanceOf(GracefulShutdown)
    })
  })

  describe('isShutting state', () => {
    it('should start as not shutting down', () => {
      expect(shutdown.isShutting()).toBe(false)
    })
  })

  describe('connection tracking', () => {
    it('should track connections with real EventEmitter', () => {
      const { conn } = createTrackedConnection()

      const beforeCount = shutdown.getActiveConnections()
      shutdown.trackConnection(conn)

      expect(shutdown.getActiveConnections()).toBe(beforeCount + 1)

      // Simulate connection close by emitting the 'close' event
      conn.emit('close')

      expect(shutdown.getActiveConnections()).toBe(beforeCount)
    })

    it('should track multiple connections', () => {
      const tracker1 = createTrackedConnection()
      const tracker2 = createTrackedConnection()

      const beforeCount = shutdown.getActiveConnections()
      shutdown.trackConnection(tracker1.conn)
      shutdown.trackConnection(tracker2.conn)

      expect(shutdown.getActiveConnections()).toBe(beforeCount + 2)

      // Close one connection
      tracker1.conn.emit('close')
      expect(shutdown.getActiveConnections()).toBe(beforeCount + 1)

      // Close the other
      tracker2.conn.emit('close')
      expect(shutdown.getActiveConnections()).toBe(beforeCount)
    })

    it('should handle connection with close method', () => {
      const { conn, closeCalls } = createTrackedConnection()

      const beforeCount = shutdown.getActiveConnections()
      shutdown.trackConnection(conn)

      // Call the close method which emits 'close' event
      conn.close()
      expect(closeCalls).toHaveLength(1)
      expect(shutdown.getActiveConnections()).toBe(beforeCount)
    })

    it('should handle connection with destroy method', () => {
      const { conn, destroyCalls } = createTrackedConnection()

      const beforeCount = shutdown.getActiveConnections()
      shutdown.trackConnection(conn)

      // Call the destroy method which emits 'close' event
      conn.destroy()
      expect(destroyCalls).toHaveLength(1)
      expect(shutdown.getActiveConnections()).toBe(beforeCount)
    })

    it('should handle connection error events independently', () => {
      const { conn, errorCalls } = createTrackedConnection()

      shutdown.trackConnection(conn)

      // Emit an error on the connection - should not affect tracking
      conn.emit('error', new Error('connection reset'))
      expect(errorCalls).toHaveLength(1)
      expect(errorCalls[0].err.message).toBe('connection reset')

      // Connection should still be tracked (error does not close it)
      expect(shutdown.getActiveConnections()).toBeGreaterThan(0)

      // Clean up
      conn.emit('close')
    })
  })

  describe('Connection event tracking', () => {
    it('should track end events', () => {
      const { conn, endCalls } = createTrackedConnection()

      conn.emit('end')
      expect(endCalls).toHaveLength(1)

      conn.emit('end')
      conn.emit('end')
      expect(endCalls).toHaveLength(3)
    })

    it('should track multiple event types independently', () => {
      const { conn, closeCalls, endCalls, errorCalls } = createTrackedConnection()

      conn.emit('end')
      conn.emit('error', new Error('test'))

      expect(closeCalls).toHaveLength(0)
      expect(endCalls).toHaveLength(1)
      expect(errorCalls).toHaveLength(1)
    })

    it('should track close via close method', () => {
      const { conn, closeCalls, destroyCalls } = createTrackedConnection()

      conn.close()
      expect(closeCalls).toHaveLength(1)
      expect(destroyCalls).toHaveLength(0)
    })

    it('should track destroy via destroy method', () => {
      const { conn, closeCalls, destroyCalls } = createTrackedConnection()

      conn.destroy()
      expect(destroyCalls).toHaveLength(1)
      expect(closeCalls).toHaveLength(0) // destroy calls its own path, not close()
    })
  })
})