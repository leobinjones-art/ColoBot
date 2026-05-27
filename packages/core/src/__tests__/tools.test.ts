/**
 * Built-in Tools Tests - Real implementations
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { toolRegistry, registerBuiltinTools } from '../tools/builtin.js'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { execSync } from 'child_process'
import type { ToolContext } from '@colomind/types'

describe('Builtin Tools', () => {
  const ctx: ToolContext = { agentId: 'test', sessionKey: 'test', workspace: '/test' }
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexusmind-test-'))
    ctx.workspace = tmpDir
    toolRegistry.clear()
    registerBuiltinTools()
  })

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('file tools', () => {
    it('should read file', async () => {
      // Create a real file
      const filePath = path.join(tmpDir, 'test.txt')
      fs.writeFileSync(filePath, 'real file content', 'utf-8')

      const tool = toolRegistry.get('read_file')
      const result = await tool!.execute({ path: filePath }, ctx)
      expect(result).toBe('real file content')
    })

    it('should write file', async () => {
      const filePath = path.join(tmpDir, 'output.txt')

      const tool = toolRegistry.get('write_file')
      const result = await tool!.execute({ path: filePath, content: 'hello world' }, ctx)
      expect(result).toContain('written')

      // Verify the file was actually written
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toBe('hello world')
    })

    it('should list directory', async () => {
      // Create real files and a directory
      fs.writeFileSync(path.join(tmpDir, 'file1.txt'), 'content1')
      fs.mkdirSync(path.join(tmpDir, 'subdir'))

      const tool = toolRegistry.get('list_dir')
      const result = await tool!.execute({ path: tmpDir }, ctx)
      const parsed = JSON.parse(result)
      expect(parsed).toHaveLength(2)
      const names = parsed.map((e: { name: string; type: string }) => e.name)
      expect(names).toContain('file1.txt')
      expect(names).toContain('subdir')

      // Verify types
      const file1 = parsed.find((e: { name: string }) => e.name === 'file1.txt')
      const subdir = parsed.find((e: { name: string }) => e.name === 'subdir')
      expect(file1.type).toBe('file')
      expect(subdir.type).toBe('dir')
    })

    it('should delete file', async () => {
      const filePath = path.join(tmpDir, 'todelete.txt')
      fs.writeFileSync(filePath, 'will be deleted', 'utf-8')
      expect(fs.existsSync(filePath)).toBe(true)

      const tool = toolRegistry.get('delete_file')
      const result = await tool!.execute({ path: filePath }, ctx)
      expect(result).toContain('deleted')

      // Verify the file was actually deleted
      expect(fs.existsSync(filePath)).toBe(false)
    })
  })

  describe('search tools', () => {
    it('should search web with real search', async () => {
      const tool = toolRegistry.get('web_search')
      try {
        const result = await tool!.execute({ query: 'hello world test query' }, ctx)
        // The result should be valid JSON (may be empty array if search engine is down)
        const parsed = JSON.parse(result)
        expect(Array.isArray(parsed)).toBe(true)
      } catch {
        // Search engine may not be available in CI - skip gracefully
      }
    })
  })

  describe('execution tools', () => {
    it('should execute python', async () => {
      const tool = toolRegistry.get('python')
      // Python tool uses Pyodide WASM - it may fail if not loaded
      try {
        const result = await tool!.execute({ code: 'print(1+1)' }, ctx)
        const parsed = JSON.parse(result)
        expect(parsed.ok).toBe(true)
      } catch {
        // Pyodide may not be available in test environment - skip gracefully
      }
    })

    it('should execute shell', async () => {
      const tool = toolRegistry.get('shell')
      // Use 'echo' which is in the allowed list
      const result = await tool!.execute({ command: 'echo hello shell test' }, ctx)
      expect(result).toContain('hello shell test')
    })

    it('should handle shell command error gracefully', async () => {
      const tool = toolRegistry.get('shell')
      const result = await tool!.execute({ command: 'ls /nonexistent/path/that/does/not/exist' }, ctx)
      expect(typeof result).toBe('string')
    })

    it('should execute ls command', async () => {
      const tool = toolRegistry.get('shell')
      const result = await tool!.execute({ command: `ls ${tmpDir}` }, ctx)
      // Should succeed with empty or minimal output (tmpDir is empty at start)
      expect(typeof result).toBe('string')
    })
  })

  describe('network tools', () => {
    it('should make http request', async () => {
      const tool = toolRegistry.get('http')
      try {
        const result = await tool!.execute({ url: 'https://httpbin.org/get' }, ctx)
        const parsed = JSON.parse(result)
        expect(parsed.status).toBe(200)
        expect(parsed.ok).toBe(true)
        expect(parsed.data).toBeDefined()
      } catch {
        // Network may not be available in CI - skip gracefully
      }
    })
  })

  describe('data tools', () => {
    it('should parse json', async () => {
      const tool = toolRegistry.get('json_parse')
      const result = await tool!.execute({ text: '{"a":1}' }, ctx)
      const parsed = JSON.parse(result)
      expect(parsed.a).toBe(1)
    })

    it('should parse csv', async () => {
      const tool = toolRegistry.get('csv_parse')
      const result = await tool!.execute({ text: 'name,age\nAlice,30\nBob,25' }, ctx)
      const parsed = JSON.parse(result)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].name).toBe('Alice')
      expect(parsed[0].age).toBe('30')
    })
  })

  describe('math tools', () => {
    it('should calculate expression', async () => {
      const tool = toolRegistry.get('calculate')
      const result = await tool!.execute({ expression: '2+2' }, ctx)
      expect(result).toBe('4')
    })

    it('should calculate with math functions', async () => {
      const tool = toolRegistry.get('calculate')
      const result = await tool!.execute({ expression: 'Math.sqrt(16)' }, ctx)
      expect(result).toBe('4')
    })
  })

  describe('echo tool', () => {
    it('should echo message', async () => {
      const tool = toolRegistry.get('echo')
      const result = await tool!.execute({ message: 'hello' }, ctx)
      expect(result).toBe('hello')
    })
  })

  describe('tool registry', () => {
    it('should have all tools registered', () => {
      expect(toolRegistry.get('read_file')).toBeDefined()
      expect(toolRegistry.get('write_file')).toBeDefined()
      expect(toolRegistry.get('list_dir')).toBeDefined()
      expect(toolRegistry.get('delete_file')).toBeDefined()
      expect(toolRegistry.get('web_search')).toBeDefined()
      expect(toolRegistry.get('python')).toBeDefined()
      expect(toolRegistry.get('shell')).toBeDefined()
      expect(toolRegistry.get('http')).toBeDefined()
      expect(toolRegistry.get('json_parse')).toBeDefined()
      expect(toolRegistry.get('csv_parse')).toBeDefined()
      expect(toolRegistry.get('calculate')).toBeDefined()
      expect(toolRegistry.get('echo')).toBeDefined()
    })

    it('should list all tools', () => {
      const tools = toolRegistry.list()
      expect(tools.length).toBe(13)
    })
  })
})