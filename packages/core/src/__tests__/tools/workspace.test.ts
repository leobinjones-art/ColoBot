/**
 * Workspace Tool Tests — 真实文件系统操作
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { toolRegistry } from '../../tools/registry.js'
import { registerWorkspaceTools } from '../../tools/workspace.js'
import type { ToolContext } from '@colomind/types'

let tmpDir: string
const ctx: ToolContext = { agentId: 'test-agent', sessionKey: 'test-session' }

describe('Workspace Tools', () => {
  beforeEach(async () => {
    // 每个测试用独立的临时目录
    tmpDir = path.join(os.tmpdir(), `workspace-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    await fs.mkdir(tmpDir, { recursive: true })
    toolRegistry.clear()
    registerWorkspaceTools()
  })

  afterEach(async () => {
    // 清理临时目录
    try {
      await fs.rm(tmpDir, { recursive: true, force: true })
    } catch {
      // 忽略清理失败
    }
  })

  describe('tool definitions', () => {
    it('should register workspace_read tool', () => {
      const tool = toolRegistry.get('workspace_read')
      expect(tool).toBeDefined()
      expect(tool!.name).toBe('workspace_read')
      expect(tool!.description).toContain('Read file')
      expect((tool!.parameters as any).properties.file_path).toBeDefined()
      expect((tool!.parameters as any).required).toContain('file_path')
    })

    it('should register workspace_write tool', () => {
      const tool = toolRegistry.get('workspace_write')
      expect(tool).toBeDefined()
      expect(tool!.name).toBe('workspace_write')
      expect((tool!.parameters as any).properties.file_path).toBeDefined()
      expect((tool!.parameters as any).properties.content).toBeDefined()
      expect((tool!.parameters as any).required).toContain('file_path')
      expect((tool!.parameters as any).required).toContain('content')
    })

    it('should register workspace_list tool', () => {
      const tool = toolRegistry.get('workspace_list')
      expect(tool).toBeDefined()
      expect(tool!.name).toBe('workspace_list')
      expect((tool!.parameters as any).required).toEqual([])
    })

    it('should register workspace_delete tool', () => {
      const tool = toolRegistry.get('workspace_delete')
      expect(tool).toBeDefined()
      expect(tool!.name).toBe('workspace_delete')
      expect((tool!.parameters as any).properties.file_path).toBeDefined()
      expect((tool!.parameters as any).required).toContain('file_path')
    })

    it('should register all 4 workspace tools', () => {
      const tools = toolRegistry.list()
      expect(tools).toHaveLength(4)
    })
  })

  describe('workspace_read - 文件读取操作', () => {
    it('should read file content and return JSON with metadata', async () => {
      // 创建真实文件
      const filePath = path.join(tmpDir, 'test.txt')
      await fs.writeFile(filePath, 'file content here', 'utf-8')

      const tool = toolRegistry.get('workspace_read')!
      const result = await tool.execute({ file_path: filePath }, ctx)
      const parsed = JSON.parse(result)

      expect(parsed.ok).toBe(true)
      expect(parsed.content).toBe('file content here')
      expect(parsed.size).toBe('file content here'.length)
    })

    it('should throw for missing files', async () => {
      const tool = toolRegistry.get('workspace_read')!
      const missingPath = path.join(tmpDir, 'missing.txt')

      await expect(
        tool.execute({ file_path: missingPath }, ctx),
      ).rejects.toThrow('File not found')
    })

    it('should throw when path is a directory', async () => {
      const tool = toolRegistry.get('workspace_read')!
      const dirPath = path.join(tmpDir, 'isadir')
      await fs.mkdir(dirPath, { recursive: true })

      await expect(
        tool.execute({ file_path: dirPath }, ctx),
      ).rejects.toThrow('Path is a directory')
    })
  })

  describe('workspace_write - 文件写入操作', () => {
    it('should write file content and return JSON with metadata', async () => {
      const filePath = path.join(tmpDir, 'output.txt')

      const tool = toolRegistry.get('workspace_write')!
      const result = await tool.execute(
        { file_path: filePath, content: 'hello world' },
        ctx,
      )
      const parsed = JSON.parse(result)

      expect(parsed.ok).toBe(true)
      expect(parsed.size).toBe('hello world'.length)

      // 验证文件确实被写入
      const writtenContent = await fs.readFile(filePath, 'utf-8')
      expect(writtenContent).toBe('hello world')
    })

    it('should create parent directories before writing', async () => {
      const filePath = path.join(tmpDir, 'deep', 'nested', 'file.txt')

      const tool = toolRegistry.get('workspace_write')!
      await tool.execute(
        { file_path: filePath, content: 'data' },
        ctx,
      )

      // 文件应该被创建
      const writtenContent = await fs.readFile(filePath, 'utf-8')
      expect(writtenContent).toBe('data')
    })

    it('should reject writes outside sandbox', async () => {
      const tool = toolRegistry.get('workspace_write')!
      await expect(
        tool.execute(
          { file_path: '/etc/evil', content: 'hack', sub_agent_id: 'agent-1' },
          ctx,
        ),
      ).rejects.toThrow('Access denied')
    })
  })

  describe('workspace_list - 目录列表', () => {
    it('should list directory contents', async () => {
      // 创建真实文件和目录
      await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'content', 'utf-8')
      await fs.mkdir(path.join(tmpDir, 'subdir'), { recursive: true })

      const tool = toolRegistry.get('workspace_list')!
      const result = await tool.execute(
        { dir_path: tmpDir },
        ctx,
      )
      const parsed = JSON.parse(result)

      expect(parsed.entries).toHaveLength(2)
      const names = parsed.entries.map((e: any) => e.name)
      expect(names).toContain('file1.txt')
      expect(names).toContain('subdir')

      const fileEntry = parsed.entries.find((e: any) => e.name === 'file1.txt')
      const dirEntry = parsed.entries.find((e: any) => e.name === 'subdir')
      expect(fileEntry.type).toBe('file')
      expect(dirEntry.type).toBe('dir')
    })

    it('should throw for missing directories', async () => {
      const tool = toolRegistry.get('workspace_list')!
      const missingDir = path.join(tmpDir, 'missing')

      await expect(
        tool.execute({ dir_path: missingDir }, ctx),
      ).rejects.toThrow('Directory not found')
    })

    it('should reject listing outside sandbox when sub_agent_id is set', async () => {
      const tool = toolRegistry.get('workspace_list')!
      await expect(
        tool.execute(
          { dir_path: '/etc', sub_agent_id: 'agent-1' },
          ctx,
        ),
      ).rejects.toThrow('Access denied')
    })
  })

  describe('workspace_delete - 文件删除', () => {
    it('should delete a file and return ok', async () => {
      const filePath = path.join(tmpDir, 'unwanted.txt')
      await fs.writeFile(filePath, 'to be deleted', 'utf-8')

      const tool = toolRegistry.get('workspace_delete')!
      const result = await tool.execute(
        { file_path: filePath },
        ctx,
      )
      const parsed = JSON.parse(result)

      expect(parsed.ok).toBe(true)

      // 验证文件确实被删除
      await expect(fs.access(filePath)).rejects.toThrow()
    })

    it('should throw for missing files', async () => {
      const tool = toolRegistry.get('workspace_delete')!
      const missingPath = path.join(tmpDir, 'missing.txt')

      await expect(
        tool.execute({ file_path: missingPath }, ctx),
      ).rejects.toThrow('File not found')
    })

    it('should reject deletes outside sandbox', async () => {
      const tool = toolRegistry.get('workspace_delete')!
      await expect(
        tool.execute(
          { file_path: '/etc/passwd', sub_agent_id: 'agent-1' },
          ctx,
        ),
      ).rejects.toThrow('Access denied')
    })
  })
})
