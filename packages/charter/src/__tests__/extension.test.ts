import { describe, it, expect } from 'vitest'
import {
  validateCharterDefinition,
  validateLibraryDefinition,
  loadCharter,
  loadLibrary,
  loadCharters,
  loadLibraries,
  exportCharter,
  exportLibrary,
} from '../extension.js'
import { charterManager, ACADEMIC_CHARTER, ACADEMIC_LIBRARY } from '../index.js'
import type { CharterDefinition, DocumentLibrary } from '../types.js'

describe('Charter Extension', () => {
  describe('validateCharterDefinition', () => {
    it('should validate a correct charter', () => {
      const result = validateCharterDefinition(ACADEMIC_CHARTER)
      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should reject missing required fields', () => {
      const charter = { id: 'charter-test' }
      const result = validateCharterDefinition(charter)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing required field: type')
    })

    it('should reject invalid id format', () => {
      const charter = {
        id: 'invalid-id',
        type: 'test',
        name: 'Test',
        description: 'Test charter',
        capabilities: [{ name: 'test' }],
        libraryId: 'library-test',
      }
      const result = validateCharterDefinition(charter)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('ID must match pattern'))).toBe(true)
    })

    it('should reject validityMs out of range', () => {
      const charter = {
        ...ACADEMIC_CHARTER,
        validityMs: 1000, // too short
      }
      const result = validateCharterDefinition(charter)
      expect(result.valid).toBe(false)
    })
  })

  describe('validateLibraryDefinition', () => {
    it('should validate a correct library', () => {
      const result = validateLibraryDefinition(ACADEMIC_LIBRARY)
      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should reject missing entries', () => {
      const library = {
        id: 'library-test',
        name: 'Test',
        description: 'Test library',
        entries: [],
      }
      const result = validateLibraryDefinition(library)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Entries must have at least one item')
    })

    it('should reject invalid entry type', () => {
      const library = {
        id: 'library-test',
        name: 'Test',
        description: 'Test library',
        entries: [
          {
            id: 'entry-1',
            type: 'invalid-type',
            title: 'Test',
            content: 'Test content',
          },
        ],
      }
      const result = validateLibraryDefinition(library)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Invalid entry type'))).toBe(true)
    })
  })

  describe('loadCharter', () => {
    it('should load a valid charter', () => {
      const charter: CharterDefinition = {
        id: 'charter-test-load',
        type: 'test-load',
        name: 'Test Load Charter',
        description: 'Test charter for loading',
        capabilities: [{ name: 'test-capability' }],
        libraryId: 'library-general',
        validityMs: 3600000,
        requireConfirmation: false,
        createdAt: Date.now(),
      }

      const result = loadCharter(charter)
      expect(result.valid).toBe(true)

      // Verify it was added to manager
      const loaded = charterManager.getCharterDefinition('charter-test-load')
      expect(loaded).toBeDefined()
    })

    it('should reject invalid charter', () => {
      const charter = { id: 'invalid' }
      const result = loadCharter(charter as CharterDefinition)
      expect(result.valid).toBe(false)
    })
  })

  describe('loadLibrary', () => {
    it('should load a valid library', () => {
      const library: DocumentLibrary = {
        id: 'library-test-load',
        name: 'Test Load Library',
        description: 'Test library for loading',
        entries: [
          {
            id: 'entry-1',
            type: 'template',
            title: 'Test Template',
            content: 'Test content',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      }

      const result = loadLibrary(library)
      expect(result.valid).toBe(true)

      const loaded = charterManager.getLibrary('library-test-load')
      expect(loaded).toBeDefined()
    })
  })

  describe('loadCharters', () => {
    it('should load multiple charters', () => {
      const charters: CharterDefinition[] = [
        {
          id: 'charter-batch-1',
          type: 'batch-1',
          name: 'Batch 1',
          description: 'Batch test 1',
          capabilities: [{ name: 'test' }],
          libraryId: 'library-general',
          validityMs: 3600000,
          requireConfirmation: false,
          createdAt: Date.now(),
        },
        {
          id: 'charter-batch-2',
          type: 'batch-2',
          name: 'Batch 2',
          description: 'Batch test 2',
          capabilities: [{ name: 'test' }],
          libraryId: 'library-general',
          validityMs: 3600000,
          requireConfirmation: false,
          createdAt: Date.now(),
        },
      ]

      const result = loadCharters(charters)
      expect(result.loaded.length).toBe(2)
      expect(result.failed.length).toBe(0)
    })

    it('should report failures', () => {
      const charters: CharterDefinition[] = [
        {
          id: 'charter-valid',
          type: 'valid',
          name: 'Valid',
          description: 'Valid charter',
          capabilities: [{ name: 'test' }],
          libraryId: 'library-general',
          validityMs: 3600000,
          requireConfirmation: false,
          createdAt: Date.now(),
        },
        { id: 'invalid' } as CharterDefinition,
      ]

      const result = loadCharters(charters)
      expect(result.loaded.length).toBe(1)
      expect(result.failed.length).toBe(1)
    })
  })

  describe('loadLibraries', () => {
    it('should load multiple libraries', () => {
      const libraries: DocumentLibrary[] = [
        {
          id: 'library-batch-1',
          name: 'Batch 1',
          description: 'Batch test 1',
          entries: [
            {
              id: 'e1',
              type: 'template',
              title: 'T1',
              content: 'C1',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
        },
        {
          id: 'library-batch-2',
          name: 'Batch 2',
          description: 'Batch test 2',
          entries: [
            {
              id: 'e2',
              type: 'template',
              title: 'T2',
              content: 'C2',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
        },
      ]

      const result = loadLibraries(libraries)
      expect(result.loaded.length).toBe(2)
      expect(result.failed.length).toBe(0)
    })
  })

  describe('export functions', () => {
    it('should export charter as JSON', () => {
      const json = exportCharter(ACADEMIC_CHARTER)
      const parsed = JSON.parse(json)
      expect(parsed.id).toBe('charter-academic')
    })

    it('should export library as JSON', () => {
      const json = exportLibrary(ACADEMIC_LIBRARY)
      const parsed = JSON.parse(json)
      expect(parsed.id).toBe('library-academic')
    })
  })
})