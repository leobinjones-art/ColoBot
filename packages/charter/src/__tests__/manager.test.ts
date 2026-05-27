import { describe, it, expect, beforeEach } from 'vitest'
import { CharterManager } from '../manager.js'
import { BUILTIN_CHARTERS, getBuiltinCharter, listBuiltinCharterTypes } from '../charters/index.js'
import { BUILTIN_LIBRARIES, getBuiltinLibrary, listBuiltinLibraries } from '../libraries/index.js'
import type { CharterDefinition, DocumentLibrary } from '../types.js'

// ═══════════════════════════════════════════════════════════════
// Charter loading and validation
// ═══════════════════════════════════════════════════════════════

describe('Charter Loading and Validation', () => {
  let manager: CharterManager

  beforeEach(() => {
    manager = new CharterManager()
  })

  describe('built-in charter loading', () => {
    it('should load all three built-in charters on construction', () => {
      const definitions = manager.listCharterDefinitions()
      expect(definitions.length).toBe(3)
    })

    it('should load academic charter with correct structure', () => {
      const academic = getBuiltinCharter('academic')
      expect(academic).toBeDefined()
      expect(academic!.id).toBe('charter-academic')
      expect(academic!.type).toBe('academic')
      expect(academic!.name).toBe('Academic Writing Charter')
      expect(academic!.description.length).toBeGreaterThanOrEqual(10)
      expect(academic!.capabilities.length).toBe(3)
      expect(academic!.libraryId).toBe('library-academic')
      expect(academic!.validityMs).toBe(24 * 60 * 60 * 1000)
      expect(academic!.requireConfirmation).toBe(true)
    })

    it('should load legal charter with correct structure', () => {
      const legal = getBuiltinCharter('legal')
      expect(legal).toBeDefined()
      expect(legal!.id).toBe('charter-legal')
      expect(legal!.type).toBe('legal')
      expect(legal!.capabilities.length).toBe(3)
      expect(legal!.libraryId).toBe('library-legal')
      expect(legal!.validityMs).toBe(12 * 60 * 60 * 1000)
      expect(legal!.requireConfirmation).toBe(true)
    })

    it('should load longdoc charter with correct structure', () => {
      const longdoc = getBuiltinCharter('longdoc')
      expect(longdoc).toBeDefined()
      expect(longdoc!.id).toBe('charter-longdoc')
      expect(longdoc!.type).toBe('longdoc')
      expect(longdoc!.capabilities.length).toBe(3)
      expect(longdoc!.libraryId).toBe('library-general')
      expect(longdoc!.validityMs).toBe(6 * 60 * 60 * 1000)
      expect(longdoc!.requireConfirmation).toBe(false)
    })

    it('should have unique IDs for all built-in charters', () => {
      const ids = Object.values(BUILTIN_CHARTERS).map((c) => c.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should have unique types for all built-in charters', () => {
      const types = Object.values(BUILTIN_CHARTERS).map((c) => c.type)
      const uniqueTypes = new Set(types)
      expect(uniqueTypes.size).toBe(types.length)
    })
  })

  describe('listBuiltinCharterTypes', () => {
    it('should return all three types', () => {
      const types = listBuiltinCharterTypes()
      expect(types).toContain('academic')
      expect(types).toContain('legal')
      expect(types).toContain('longdoc')
      expect(types.length).toBe(3)
    })
  })

  describe('getBuiltinCharter', () => {
    it('should return undefined for unknown type', () => {
      expect(getBuiltinCharter('nonexistent')).toBeUndefined()
    })

    it('should return the charter definition for known type', () => {
      const charter = getBuiltinCharter('academic')
      expect(charter).toBe(BUILTIN_CHARTERS.academic)
    })
  })

  describe('charter definition field validation', () => {
    it('should have capabilities with name property for all built-in charters', () => {
      for (const charter of Object.values(BUILTIN_CHARTERS)) {
        for (const cap of charter.capabilities) {
          expect(cap.name).toBeTruthy()
          expect(typeof cap.name).toBe('string')
        }
      }
    })

    it('should have non-empty description for all built-in charters', () => {
      for (const charter of Object.values(BUILTIN_CHARTERS)) {
        expect(charter.description.length).toBeGreaterThanOrEqual(10)
      }
    })

    it('should have valid libraryId references for all built-in charters', () => {
      const libraryIds = Object.values(BUILTIN_LIBRARIES).map((l) => l.id)
      for (const charter of Object.values(BUILTIN_CHARTERS)) {
        expect(libraryIds).toContain(charter.libraryId)
      }
    })

    it('should have positive validityMs for all built-in charters', () => {
      for (const charter of Object.values(BUILTIN_CHARTERS)) {
        expect(charter.validityMs).toBeGreaterThan(0)
      }
    })

    it('should have createdAt timestamp for all built-in charters', () => {
      for (const charter of Object.values(BUILTIN_CHARTERS)) {
        expect(typeof charter.createdAt).toBe('number')
        expect(charter.createdAt).toBeGreaterThan(0)
      }
    })
  })

  describe('addCharterDefinition', () => {
    it('should add a custom charter definition', () => {
      const custom: CharterDefinition = {
        id: 'charter-custom-test',
        type: 'custom-test',
        name: 'Custom Test Charter',
        description: 'A custom charter for testing purposes',
        capabilities: [{ name: 'custom-capability' }],
        libraryId: 'library-general',
        validityMs: 3600000,
        requireConfirmation: false,
        createdAt: Date.now(),
      }

      manager.addCharterDefinition(custom)
      const loaded = manager.getCharterDefinition('charter-custom-test')
      expect(loaded).toBeDefined()
      expect(loaded!.name).toBe('Custom Test Charter')
    })

    it('should overwrite existing charter with same id', () => {
      const original = manager.getCharterDefinition('charter-academic')
      expect(original).toBeDefined()

      const modified: CharterDefinition = {
        ...original!,
        name: 'Modified Academic Charter',
      }

      manager.addCharterDefinition(modified)
      const loaded = manager.getCharterDefinition('charter-academic')
      expect(loaded!.name).toBe('Modified Academic Charter')
    })
  })

  describe('getCharterByType', () => {
    it('should find charter by type string', () => {
      const charter = manager.getCharterByType('academic')
      expect(charter).toBeDefined()
      expect(charter!.id).toBe('charter-academic')
    })

    it('should find custom charter by id pattern charter-{type}', () => {
      const custom: CharterDefinition = {
        id: 'charter-mytype',
        type: 'mytype',
        name: 'My Type Charter',
        description: 'A charter with custom type',
        capabilities: [{ name: 'my-cap' }],
        libraryId: 'library-general',
        validityMs: 3600000,
        requireConfirmation: false,
        createdAt: Date.now(),
      }
      manager.addCharterDefinition(custom)

      const found = manager.getCharterByType('mytype')
      expect(found).toBeDefined()
      expect(found!.id).toBe('charter-mytype')
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// Charter lifecycle (request, activate, revoke, expire)
// ═══════════════════════════════════════════════════════════════

describe('Charter Lifecycle', () => {
  let manager: CharterManager

  beforeEach(() => {
    manager = new CharterManager()
  })

  describe('requestCharter', () => {
    it('should throw for unknown charter type', () => {
      expect(() =>
        manager.requestCharter('user-1', { type: 'nonexistent', reason: 'test' }),
      ).toThrow('Unknown charter type')
    })

    it('should auto-activate when requireConfirmation is false', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'longdoc',
        reason: 'Writing a long document',
      })
      expect(instance.status).toBe('active')
      expect(instance.activatedAt).toBeDefined()
    })

    it('should stay pending when requireConfirmation is true', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'Writing a paper',
      })
      expect(instance.status).toBe('pending')
      expect(instance.activatedAt).toBeUndefined()
    })

    it('should generate unique instance IDs', () => {
      const i1 = manager.requestCharter('user-1', { type: 'longdoc', reason: 'A' })
      const i2 = manager.requestCharter('user-1', { type: 'longdoc', reason: 'B' })
      expect(i1.id).not.toBe(i2.id)
    })

    it('should set userId and reason on instance', () => {
      const instance = manager.requestCharter('user-42', {
        type: 'longdoc',
        reason: 'My specific reason',
        sessionId: 'session-abc',
      })
      expect(instance.userId).toBe('user-42')
      expect(instance.reason).toBe('My specific reason')
      expect(instance.sessionId).toBe('session-abc')
    })

    it('should set charterId to the definition id', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'test',
      })
      expect(instance.charterId).toBe('charter-academic')
    })
  })

  describe('activateCharter', () => {
    it('should throw for non-existent instance', () => {
      expect(() => manager.activateCharter('nonexistent', 'admin')).toThrow('Instance not found')
    })

    it('should throw when activating already active instance', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'longdoc',
        reason: 'test',
      })
      // Already auto-activated
      expect(() => manager.activateCharter(instance.id, 'admin')).toThrow('already processed')
    })

    it('should throw when activating revoked instance', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'test',
      })
      manager.revokeCharter(instance.id, 'revoked')
      expect(() => manager.activateCharter(instance.id, 'admin')).toThrow('already processed')
    })

    it('should set approvedBy and activatedAt', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'test',
      })
      const activated = manager.activateCharter(instance.id, 'approver-1')
      expect(activated.approvedBy).toBe('approver-1')
      expect(activated.approvedAt).toBeDefined()
      expect(activated.activatedAt).toBeDefined()
    })

    it('should set expiresAt based on definition validityMs', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'test',
      })
      const activated = manager.activateCharter(instance.id, 'admin')
      expect(activated.expiresAt).toBeDefined()
      expect(activated.expiresAt! - activated.activatedAt!).toBe(24 * 60 * 60 * 1000)
    })
  })

  describe('revokeCharter', () => {
    it('should throw for non-existent instance', () => {
      expect(() => manager.revokeCharter('nonexistent', 'reason')).toThrow('Instance not found')
    })

    it('should set status to revoked and store reason', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'test',
      })
      const revoked = manager.revokeCharter(instance.id, 'Policy violation')
      expect(revoked.status).toBe('revoked')
      expect(revoked.revokedReason).toBe('Policy violation')
    })

    it('should allow revoking an active charter', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'longdoc',
        reason: 'test',
      })
      expect(instance.status).toBe('active')
      const revoked = manager.revokeCharter(instance.id, 'No longer needed')
      expect(revoked.status).toBe('revoked')
    })
  })

  describe('charter expiration', () => {
    it('should mark expired charters when checking active charters', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'test',
      })
      const activated = manager.activateCharter(instance.id, 'admin')

      // Manually set expiresAt to the past
      activated.expiresAt = Date.now() - 1000

      const active = manager.getActiveCharters('user-1')
      expect(active.length).toBe(0)

      // The instance should now be marked as expired
      expect(activated.status).toBe('expired')
    })

    it('should include non-expired charters in active list', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'longdoc',
        reason: 'test',
      })
      const active = manager.getActiveCharters('user-1')
      expect(active.length).toBe(1)
      expect(active[0].id).toBe(instance.id)
    })
  })

  describe('cleanupExpired', () => {
    it('should return 0 when no expired charters', () => {
      manager.requestCharter('user-1', { type: 'longdoc', reason: 'test' })
      const count = manager.cleanupExpired()
      expect(count).toBe(0)
    })

    it('should count and mark expired charters', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'test',
      })
      const activated = manager.activateCharter(instance.id, 'admin')
      activated.expiresAt = Date.now() - 1000

      const count = manager.cleanupExpired()
      expect(count).toBe(1)
      expect(activated.status).toBe('expired')
    })
  })

  describe('getInstance and getInstanceStatus', () => {
    it('should return instance by id', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'longdoc',
        reason: 'test',
      })
      const retrieved = manager.getInstance(instance.id)
      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe(instance.id)
    })

    it('should return undefined for non-existent instance', () => {
      expect(manager.getInstance('nonexistent')).toBeUndefined()
    })

    it('should return status by id', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'longdoc',
        reason: 'test',
      })
      expect(manager.getInstanceStatus(instance.id)).toBe('active')
    })

    it('should return undefined status for non-existent instance', () => {
      expect(manager.getInstanceStatus('nonexistent')).toBeUndefined()
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// Capability and tool checking
// ═══════════════════════════════════════════════════════════════

describe('Capability and Tool Checking', () => {
  let manager: CharterManager

  beforeEach(() => {
    manager = new CharterManager()
  })

  describe('checkCapability', () => {
    it('should allow capability for user with matching active charter', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'test',
      })
      manager.activateCharter(instance.id, 'admin')

      const result = manager.checkCapability('user-1', 'paper-writing')
      expect(result.allowed).toBe(true)
      expect(result.capability).toBeDefined()
      expect(result.capability!.name).toBe('paper-writing')
      expect(result.charter).toBeDefined()
    })

    it('should deny capability for user without active charter', () => {
      const result = manager.checkCapability('user-2', 'paper-writing')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('No active charter')
    })

    it('should deny capability for user with pending (not active) charter', () => {
      manager.requestCharter('user-1', { type: 'academic', reason: 'test' })
      // academic requires confirmation, so it stays pending
      const result = manager.checkCapability('user-1', 'paper-writing')
      expect(result.allowed).toBe(false)
    })

    it('should deny capability for user with revoked charter', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'longdoc',
        reason: 'test',
      })
      manager.revokeCharter(instance.id, 'revoked')
      const result = manager.checkCapability('user-1', 'long-document-write')
      expect(result.allowed).toBe(false)
    })

    it('should deny unknown capability name', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'longdoc',
        reason: 'test',
      })
      const result = manager.checkCapability('user-1', 'nonexistent-capability')
      expect(result.allowed).toBe(false)
    })

    it('should check tool permission within capability', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'test',
      })
      manager.activateCharter(instance.id, 'admin')

      // paper-writing allows web_search
      const allowed = manager.checkCapability('user-1', 'paper-writing', 'web_search')
      expect(allowed.allowed).toBe(true)

      // paper-writing allows write_file
      const alsoAllowed = manager.checkCapability('user-1', 'paper-writing', 'write_file')
      expect(alsoAllowed.allowed).toBe(true)

      // paper-writing does not allow delete_file (not in allowedTools)
      const denied = manager.checkCapability('user-1', 'paper-writing', 'delete_file')
      expect(denied.allowed).toBe(false)
    })

    it('should skip capability if tool is in disallowedTools', () => {
      const custom: CharterDefinition = {
        id: 'charter-restricted',
        type: 'restricted',
        name: 'Restricted Charter',
        description: 'A charter with disallowed tools',
        capabilities: [
          {
            name: 'limited-write',
            allowedTools: ['write_file', 'read_file'],
            disallowedTools: ['delete_file'],
          },
        ],
        libraryId: 'library-general',
        validityMs: 3600000,
        requireConfirmation: false,
        createdAt: Date.now(),
      }
      manager.addCharterDefinition(custom)
      const instance = manager.requestCharter('user-1', {
        type: 'restricted',
        reason: 'test',
      })

      const result = manager.checkCapability('user-1', 'limited-write', 'delete_file')
      expect(result.allowed).toBe(false)
    })
  })

  describe('checkTool', () => {
    it('should deny tool for user without active charter', () => {
      const result = manager.checkTool('user-2', 'write_file')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('No active charter')
    })

    it('should allow tool in allowedTools list', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'test',
      })
      manager.activateCharter(instance.id, 'admin')

      const result = manager.checkTool('user-1', 'web_search')
      expect(result.allowed).toBe(true)
    })

    it('should deny tool not in any allowedTools list', () => {
      const instance = manager.requestCharter('user-1', {
        type: 'academic',
        reason: 'test',
      })
      manager.activateCharter(instance.id, 'admin')

      const result = manager.checkTool('user-1', 'delete_file')
      expect(result.allowed).toBe(false)
    })

    it('should deny tool in disallowedTools even if in another capability', () => {
      const custom: CharterDefinition = {
        id: 'charter-disallow-test',
        type: 'disallow-test',
        name: 'Disallow Test',
        description: 'Test disallowedTools behavior',
        capabilities: [
          {
            name: 'cap-with-disallow',
            allowedTools: ['write_file', 'read_file'],
            disallowedTools: ['write_file'],
          },
        ],
        libraryId: 'library-general',
        validityMs: 3600000,
        requireConfirmation: false,
        createdAt: Date.now(),
      }
      manager.addCharterDefinition(custom)
      manager.requestCharter('user-1', { type: 'disallow-test', reason: 'test' })

      const result = manager.checkTool('user-1', 'write_file')
      // write_file is in disallowedTools for cap-with-disallow, so it should be skipped
      expect(result.allowed).toBe(false)
    })

    it('should allow tool when capability has no allowedTools (default allow)', () => {
      const custom: CharterDefinition = {
        id: 'charter-open',
        type: 'open',
        name: 'Open Charter',
        description: 'A charter with no tool restrictions',
        capabilities: [{ name: 'open-cap' }],
        libraryId: 'library-general',
        validityMs: 3600000,
        requireConfirmation: false,
        createdAt: Date.now(),
      }
      manager.addCharterDefinition(custom)
      manager.requestCharter('user-1', { type: 'open', reason: 'test' })

      const result = manager.checkTool('user-1', 'any_tool')
      expect(result.allowed).toBe(true)
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// User charter management
// ═══════════════════════════════════════════════════════════════

describe('User Charter Management', () => {
  let manager: CharterManager

  beforeEach(() => {
    manager = new CharterManager()
  })

  it('should return empty array for user with no charters', () => {
    const charters = manager.getUserCharters('unknown-user')
    expect(charters).toEqual([])
  })

  it('should track multiple charters per user', () => {
    manager.requestCharter('user-1', { type: 'academic', reason: 'A' })
    manager.requestCharter('user-1', { type: 'legal', reason: 'B' })
    manager.requestCharter('user-1', { type: 'longdoc', reason: 'C' })

    const charters = manager.getUserCharters('user-1')
    expect(charters.length).toBe(3)
  })

  it('should isolate charters between users', () => {
    manager.requestCharter('user-1', { type: 'longdoc', reason: 'A' })
    manager.requestCharter('user-2', { type: 'longdoc', reason: 'B' })

    const u1 = manager.getUserCharters('user-1')
    const u2 = manager.getUserCharters('user-2')
    expect(u1.length).toBe(1)
    expect(u2.length).toBe(1)
    expect(u1[0].userId).toBe('user-1')
    expect(u2[0].userId).toBe('user-2')
  })

  it('should filter active charters correctly', () => {
    const i1 = manager.requestCharter('user-1', { type: 'longdoc', reason: 'A' })
    const i2 = manager.requestCharter('user-1', { type: 'academic', reason: 'B' })

    // longdoc is auto-activated, academic is pending
    const active = manager.getActiveCharters('user-1')
    expect(active.length).toBe(1)
    expect(active[0].id).toBe(i1.id)
  })

  it('should not include revoked charters in active list', () => {
    const instance = manager.requestCharter('user-1', {
      type: 'longdoc',
      reason: 'test',
    })
    manager.revokeCharter(instance.id, 'revoked')

    const active = manager.getActiveCharters('user-1')
    expect(active.length).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// Document library management
// ═══════════════════════════════════════════════════════════════

describe('Document Library Management', () => {
  let manager: CharterManager

  beforeEach(() => {
    manager = new CharterManager()
  })

  describe('built-in libraries', () => {
    it('should load all three built-in libraries on construction', () => {
      const academic = manager.getLibrary('library-academic')
      const legal = manager.getLibrary('library-legal')
      const general = manager.getLibrary('library-general')
      expect(academic).toBeDefined()
      expect(legal).toBeDefined()
      expect(general).toBeDefined()
    })

    it('should have entries in all built-in libraries', () => {
      for (const lib of Object.values(BUILTIN_LIBRARIES)) {
        expect(lib.entries.length).toBeGreaterThan(0)
      }
    })

    it('should have unique IDs for entries within each library', () => {
      for (const lib of Object.values(BUILTIN_LIBRARIES)) {
        const ids = lib.entries.map((e) => e.id)
        const uniqueIds = new Set(ids)
        expect(uniqueIds.size).toBe(ids.length)
      }
    })

    it('should have required fields on all library entries', () => {
      for (const lib of Object.values(BUILTIN_LIBRARIES)) {
        for (const entry of lib.entries) {
          expect(entry.id).toBeTruthy()
          expect(entry.type).toBeTruthy()
          expect(entry.title).toBeTruthy()
          expect(entry.content).toBeTruthy()
        }
      }
    })
  })

  describe('listBuiltinLibraries', () => {
    it('should return all three libraries', () => {
      const libs = listBuiltinLibraries()
      expect(libs.length).toBe(3)
    })
  })

  describe('getBuiltinLibrary', () => {
    it('should find library by key name', () => {
      const lib = getBuiltinLibrary('academic')
      expect(lib).toBeDefined()
      expect(lib!.id).toBe('library-academic')
    })

    it('should find library by full id', () => {
      const lib = getBuiltinLibrary('library-academic')
      expect(lib).toBeDefined()
      expect(lib!.id).toBe('library-academic')
    })

    it('should return undefined for unknown library', () => {
      expect(getBuiltinLibrary('nonexistent')).toBeUndefined()
    })
  })

  describe('addLibrary', () => {
    it('should add a custom library', () => {
      const custom: DocumentLibrary = {
        id: 'library-custom',
        name: 'Custom Library',
        description: 'A custom library for testing',
        entries: [
          {
            id: 'entry-1',
            type: 'template',
            title: 'Custom Template',
            content: 'Custom content',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      }

      manager.addLibrary(custom)
      const loaded = manager.getLibrary('library-custom')
      expect(loaded).toBeDefined()
      expect(loaded!.name).toBe('Custom Library')
    })
  })

  describe('getCharterLibrary', () => {
    it('should return the library bound to a charter', () => {
      const library = manager.getCharterLibrary('charter-academic')
      expect(library).toBeDefined()
      expect(library!.id).toBe('library-academic')
    })

    it('should return undefined for unknown charter', () => {
      const library = manager.getCharterLibrary('charter-nonexistent')
      expect(library).toBeUndefined()
    })
  })
})
