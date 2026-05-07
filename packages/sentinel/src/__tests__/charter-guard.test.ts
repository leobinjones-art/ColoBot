import { describe, it, expect, beforeEach } from 'vitest'
import { CharterGuard } from '../charter-guard.js'
import { CharterManager } from '@nexusmind/charter'

describe('CharterGuard', () => {
  let guard: CharterGuard
  let manager: CharterManager

  beforeEach(() => {
    // Create fresh manager for each test
    manager = new CharterManager()
    guard = new CharterGuard({ charterManager: manager, enableLogging: false })
  })

  describe('capability checking', () => {
    it('should deny capability without charter', () => {
      const result = guard.checkCapability('user-no-charter', 'paper-writing')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBeDefined()
    })

    it('should allow capability with active charter', () => {
      // Request and activate academic charter
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'Writing paper',
      })
      manager.activateCharter(instance.id, 'admin')

      const result = guard.checkCapability('user-1', 'paper-writing')

      expect(result.allowed).toBe(true)
      expect(result.charter).toBeDefined()
    })

    it('should return library entries for capability', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'Writing paper',
      })
      manager.activateCharter(instance.id, 'admin')

      const result = guard.checkCapability('user-1', 'citation-format')

      expect(result.allowed).toBe(true)
      expect(result.libraryEntries).toBeDefined()
      expect(result.libraryEntries!.length).toBeGreaterThan(0)
    })
  })

  describe('tool checking', () => {
    it('should deny tool without charter', () => {
      const result = guard.checkTool('user-no-charter', 'web_search')

      expect(result.allowed).toBe(false)
    })

    it('should allow tool with charter', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'Research',
      })
      manager.activateCharter(instance.id, 'admin')

      const result = guard.checkTool('user-1', 'web_search')

      expect(result.allowed).toBe(true)
    })
  })

  describe('charter info', () => {
    it('should get active charters', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'longdoc',
        reason: 'Long doc',
      })

      const charters = guard.getActiveCharters('user-1')

      expect(charters.length).toBe(1)
      expect(charters[0].id).toBe(instance.id)
    })

    it('should get charter library', () => {
      const library = guard.getCharterLibrary('charter-academic')

      expect(library).toBeDefined()
      expect(library?.name).toContain('Academic')
    })
  })

  describe('prompt generation', () => {
    it('should generate request prompt for user without charters', () => {
      const prompt = guard.generateCharterRequestPrompt('user-no-charter', 'paper-writing')

      expect(prompt).toContain('没有活跃的许可证')
      expect(prompt).toContain('paper-writing')
    })

    it('should generate request prompt for user with wrong charter', () => {
      manager.requestCharter('user-1', {
        type: 'longdoc',
        reason: 'Long doc',
      })

      const prompt = guard.generateCharterRequestPrompt('user-1', 'paper-writing')

      expect(prompt).toContain('不包含')
      expect(prompt).toContain('paper-writing')
    })
  })
})
