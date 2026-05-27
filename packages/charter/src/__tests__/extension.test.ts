/**
 * Charter 扩展加载测试
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CharterManager,
  validateCharterDefinition,
  validateLibraryDefinition,
  loadCharter,
  loadLibrary,
  ACADEMIC_CHARTER,
  LEGAL_CHARTER,
  ACADEMIC_LIBRARY,
  LEGAL_LIBRARY,
  getBuiltinCharter,
  getBuiltinLibrary,
  listBuiltinCharterTypes,
  listBuiltinLibraries,
  requestCharter,
  checkCapability,
  checkTool,
} from '../index.js'
import type { CharterDefinition, DocumentLibrary } from '../index.js'

describe('CharterExtension', () => {
  describe('基础加载（不需要 LLM）', () => {
    it('应该加载 CharterManager', () => {
      const manager = new CharterManager()
      expect(manager).toBeDefined()
    })

    it('应该加载内置许可证', () => {
      const academic = getBuiltinCharter('academic')
      expect(academic).toBeDefined()
      expect(academic!.id).toContain('charter-')

      const legal = getBuiltinCharter('legal')
      expect(legal).toBeDefined()
    })

    it('应该加载内置文档库', () => {
      const academicLib = getBuiltinLibrary('library-academic')
      expect(academicLib).toBeDefined()
      expect(academicLib!.id).toContain('library-')
    })

    it('应该列出内置许可证类型', () => {
      const types = listBuiltinCharterTypes()
      expect(types.length).toBeGreaterThan(0)
      expect(types).toContain('academic')
      expect(types).toContain('legal')
    })

    it('应该列出内置文档库', () => {
      const libs = listBuiltinLibraries()
      expect(libs.length).toBeGreaterThan(0)
    })

    it('应该验证 Charter 定义', () => {
      const result = validateCharterDefinition(ACADEMIC_CHARTER)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('应该验证文档库定义', () => {
      const result = validateLibraryDefinition(ACADEMIC_LIBRARY)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('应该拒绝无效 Charter', () => {
      const result = validateCharterDefinition({ id: 'bad' })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('应该拒绝无效文档库', () => {
      const result = validateLibraryDefinition({ id: 'bad' })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('应该读取 charter JSON 文件', () => {
      const charterPath = join(__dirname, '../../community/charter-medical.json')
      const content = readFileSync(charterPath, 'utf-8')
      const charter = JSON.parse(content)
      expect(charter).toBeDefined()
      expect(charter.name || charter.title || charter.version).toBeDefined()
    })

    it('应该读取 library JSON 文件', () => {
      const libraryPath = join(__dirname, '../../community/library-medical.json')
      const content = readFileSync(libraryPath, 'utf-8')
      const library = JSON.parse(content)
      expect(library).toBeDefined()
    })
  })

  describe('CharterManager', () => {
    it('应该创建 CharterManager 实例', () => {
      const manager = new CharterManager()
      expect(manager).toBeDefined()
    })

    it('应该列出许可证定义', () => {
      const manager = new CharterManager()
      const definitions = manager.listCharterDefinitions()
      expect(definitions.length).toBeGreaterThan(0)
    })

    it('应该获取许可证定义', () => {
      const manager = new CharterManager()
      const academic = manager.getCharterByType('academic')
      expect(academic).toBeDefined()
    })

    it('应该获取文档库', () => {
      const manager = new CharterManager()
      const library = manager.getLibrary('library-academic')
      expect(library).toBeDefined()
    })

    it('应该申请许可证', () => {
      const manager = new CharterManager()
      const instance = requestCharter('user-1', {
        type: 'academic',
        sessionId: 'session-1',
        reason: '学术研究',
      })
      expect(instance).toBeDefined()
      expect(instance.status).toBe('pending')
    })

    it('应该检查许可证能力', () => {
      const manager = new CharterManager()
      requestCharter('user-2', {
        type: 'academic',
        sessionId: 'session-2',
        reason: '学术研究',
      })
      const result = checkCapability('user-2', 'academic-research')
      expect(result).toBeDefined()
      expect(typeof result.allowed).toBe('boolean')
    })

    it('应该检查工具权限', () => {
      const manager = new CharterManager()
      requestCharter('user-3', {
        type: 'academic',
        sessionId: 'session-3',
        reason: '学术研究',
      })
      const result = checkTool('user-3', 'web_search')
      expect(result).toBeDefined()
      expect(typeof result.allowed).toBe('boolean')
    })

    it('应该添加自定义许可证定义', () => {
      const manager = new CharterManager()
      const customCharter: CharterDefinition = {
        id: 'charter-custom-test',
        type: 'custom-test',
        name: '自定义测试许可证',
        description: '用于测试的自定义许可证',
        capabilities: [{ name: 'custom-capability' }],
        libraryId: 'library-academic',
        validityMs: 0,
        requireConfirmation: false,
        createdAt: Date.now(),
      }
      manager.addCharterDefinition(customCharter)
      const found = manager.getCharterDefinition('charter-custom-test')
      expect(found).toBeDefined()
      expect(found!.name).toBe('自定义测试许可证')
    })

    it('应该添加自定义文档库', () => {
      const manager = new CharterManager()
      const customLibrary: DocumentLibrary = {
        id: 'library-custom-test',
        name: '自定义测试库',
        description: '用于测试的自定义文档库',
        entries: [
          { id: 'entry-1', type: 'reference', title: '测试条目', content: '测试内容', createdAt: Date.now(), updatedAt: Date.now() },
        ],
      }
      manager.addLibrary(customLibrary)
      const found = manager.getLibrary('library-custom-test')
      expect(found).toBeDefined()
      expect(found!.name).toBe('自定义测试库')
    })

    it('应该加载 Charter 通过 extension 函数', () => {
      const result = loadCharter(LEGAL_CHARTER)
      expect(result.valid).toBe(true)
    })

    it('应该加载 Library 通过 extension 函数', () => {
      const result = loadLibrary(LEGAL_LIBRARY)
      expect(result.valid).toBe(true)
    })
  })
})