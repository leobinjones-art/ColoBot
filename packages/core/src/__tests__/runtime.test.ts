/**
 * Runtime 模块测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Runtime Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Runtime Interface', () => {
    it('should define runtime interface', async () => {
      const { ColoBotRuntimeImpl } = await import('../runtime/runtime.js')
      expect(ColoBotRuntimeImpl).toBeDefined()
    })
  })

  describe('Runtime Types', () => {
    it('should export runtime types', async () => {
      const types = await import('../runtime/types.js')
      expect(types).toBeDefined()
    })
  })
})
