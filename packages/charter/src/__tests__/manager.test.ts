import { describe, it, expect, beforeEach } from 'vitest'
import { CharterManager, charterManager } from '../manager.js'
import { BUILTIN_CHARTERS, getBuiltinCharter } from '../charters/index.js'
import { BUILTIN_LIBRARIES, getBuiltinLibrary } from '../libraries/index.js'

describe('CharterManager', () => {
  let manager: CharterManager

  beforeEach(() => {
    manager = new CharterManager()
  })

  describe('charter definitions', () => {
    it('should load built-in charters', () => {
      const definitions = manager.listCharterDefinitions()
      expect(definitions.length).toBeGreaterThan(0)
    })

    it('should get charter by type', () => {
      const academic = manager.getCharterByType('academic')
      expect(academic).toBeDefined()
      expect(academic?.name).toContain('Academic')
    })

    it('should return undefined for unknown type', () => {
      const unknown = manager.getCharterByType('unknown')
      expect(unknown).toBeUndefined()
    })
  })

  describe('charter lifecycle', () => {
    it('should request a charter', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'longdoc', // longdoc doesn't require confirmation
        reason: 'Writing a long document',
      })

      expect(instance.id).toBeDefined()
      expect(instance.status).toBe('active') // auto-activated
      expect(instance.userId).toBe('user-1')
    })

    it('should keep charter pending when confirmation required', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic', // academic requires confirmation
        reason: 'Writing a paper',
      })

      expect(instance.status).toBe('pending')
    })

    it('should activate a pending charter', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'Writing',
      })

      expect(instance.status).toBe('pending')

      const activated = manager.activateCharter(instance.id, 'admin-1')
      expect(activated.status).toBe('active')
      expect(activated.approvedBy).toBe('admin-1')
    })

    it('should revoke a charter', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'Writing',
      })

      const revoked = manager.revokeCharter(instance.id, 'No longer needed')
      expect(revoked.status).toBe('revoked')
      expect(revoked.revokedReason).toBe('No longer needed')
    })
  })

  describe('capability checking', () => {
    it('should check capability for user with active charter', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'Writing paper',
      })
      manager.activateCharter(instance.id, 'admin-1')

      const result = manager.checkCapability('user-1', 'paper-writing')
      expect(result.allowed).toBe(true)
      expect(result.capability).toBeDefined()
    })

    it('should deny capability for user without charter', () => {
      const result = manager.checkCapability('user-2', 'paper-writing')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('No active charter')
    })

    it('should check tool permissions', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'Writing paper',
      })
      manager.activateCharter(instance.id, 'admin-1')

      const result = manager.checkTool('user-1', 'web_search')
      expect(result.allowed).toBe(true)
    })
  })

  describe('document libraries', () => {
    it('should get library by id', () => {
      const library = manager.getLibrary('library-academic')
      expect(library).toBeDefined()
      expect(library?.name).toContain('Academic')
    })

    it('should get charter library', () => {
      const academic = manager.getCharterByType('academic')
      const library = manager.getCharterLibrary(academic!.id)
      expect(library).toBeDefined()
      expect(library?.id).toBe('library-academic')
    })
  })

  describe('user charters', () => {
    it('should get user charters', () => {
      manager.requestCharter('user-1', { type: 'academic', reason: 'A' })
      manager.requestCharter('user-1', { type: 'legal', reason: 'B' })

      const charters = manager.getUserCharters('user-1')
      expect(charters.length).toBe(2)
    })

    it('should get active charters only', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'Test',
      })

      manager.revokeCharter(instance.id, 'Revoked')

      const active = manager.getActiveCharters('user-1')
      expect(active.length).toBe(0)
    })
  })
})

describe('Built-in charters', () => {
  it('should have academic charter', () => {
    const academic = getBuiltinCharter('academic')
    expect(academic).toBeDefined()
    expect(academic?.capabilities.length).toBeGreaterThan(0)
  })

  it('should have legal charter', () => {
    const legal = getBuiltinCharter('legal')
    expect(legal).toBeDefined()
  })

  it('should have longdoc charter', () => {
    const longdoc = getBuiltinCharter('longdoc')
    expect(longdoc).toBeDefined()
    expect(longdoc?.capabilities.some(c => c.name === 'long-document-write')).toBe(true)
  })
})

describe('Built-in libraries', () => {
  it('should have academic library', () => {
    const library = getBuiltinLibrary('academic')
    expect(library).toBeDefined()
    expect(library?.entries.length).toBeGreaterThan(0)
  })

  it('should have legal library', () => {
    const library = getBuiltinLibrary('legal')
    expect(library).toBeDefined()
  })

  it('should have general library', () => {
    const library = getBuiltinLibrary('general')
    expect(library).toBeDefined()
  })
})
