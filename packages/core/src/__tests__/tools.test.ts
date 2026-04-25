/**
 * 内置工具测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toolRegistry, registerBuiltinTools } from '../tools/builtin.js';
import * as fs from 'fs';
import type { ToolContext } from '@colobot/types';

// Mock fs
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(async () => 'file content'),
    writeFile: vi.fn(async () => {}),
    readdir: vi.fn(async () => [
      { name: 'file1.txt', isDirectory: () => false },
      { name: 'dir1', isDirectory: () => true },
    ]),
    mkdir: vi.fn(async () => {}),
    unlink: vi.fn(async () => {}),
  },
}));

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn((cmd: string, options: any) => {
    if (cmd === 'python3') {
      return 'python output';
    }
    return 'shell output';
  }),
}));

// Mock fetch
global.fetch = vi.fn(async (url: string) => ({
  status: 200,
  ok: true,
  headers: {
    get: (name: string) => name === 'content-type' ? 'application/json' : null,
  },
  json: async () => ({ result: 'ok' }),
  text: async () => 'response text',
})) as any;

// Mock search
vi.mock('../search.js', () => ({
  search: vi.fn(async () => ({
    results: [
      { title: 'Result 1', url: 'https://example.com/1', content: 'Content 1' },
      { title: 'Result 2', url: 'https://example.com/2', content: 'Content 2' },
    ],
  })),
  getSearchConfig: () => ({ maxResults: 10 }),
}));

describe('Builtin Tools', () => {
  const ctx: ToolContext = { agentId: 'test', sessionKey: 'test', workspace: '/test' };

  beforeEach(() => {
    toolRegistry.clear();
    registerBuiltinTools();
  });

  describe('file tools', () => {
    it('should read file', async () => {
      const tool = toolRegistry.get('read_file');
      const result = await tool!.execute({ path: '/test/file.txt' }, ctx);
      expect(result).toBe('file content');
    });

    it('should write file', async () => {
      const tool = toolRegistry.get('write_file');
      const result = await tool!.execute({ path: '/test/file.txt', content: 'hello' }, ctx);
      expect(result).toContain('written');
    });

    it('should list directory', async () => {
      const tool = toolRegistry.get('list_dir');
      const result = await tool!.execute({ path: '/test' }, ctx);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe('file1.txt');
      expect(parsed[0].type).toBe('file');
    });

    it('should delete file', async () => {
      const tool = toolRegistry.get('delete_file');
      const result = await tool!.execute({ path: '/test/file.txt' }, ctx);
      expect(result).toContain('deleted');
    });
  });

  describe('search tools', () => {
    it('should search web', async () => {
      const tool = toolRegistry.get('web_search');
      const result = await tool!.execute({ query: 'test query' }, ctx);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].title).toBe('Result 1');
    });
  });

  describe('execution tools', () => {
    it('should execute python', async () => {
      const tool = toolRegistry.get('python');
      const result = await tool!.execute({ code: 'print(1+1)' }, ctx);
      expect(result).toBe('python output');
    });

    it('should execute shell', async () => {
      const tool = toolRegistry.get('shell');
      const result = await tool!.execute({ command: 'echo hello' }, ctx);
      expect(result).toBe('shell output');
    });
  });

  describe('network tools', () => {
    it('should make http request', async () => {
      const tool = toolRegistry.get('http');
      const result = await tool!.execute({ url: 'https://api.example.com/test' }, ctx);
      const parsed = JSON.parse(result);
      expect(parsed.status).toBe(200);
      expect(parsed.ok).toBe(true);
    });
  });

  describe('data tools', () => {
    it('should parse json', async () => {
      const tool = toolRegistry.get('json_parse');
      const result = await tool!.execute({ text: '{"a":1}' }, ctx);
      const parsed = JSON.parse(result);
      expect(parsed.a).toBe(1);
    });

    it('should parse csv', async () => {
      const tool = toolRegistry.get('csv_parse');
      const result = await tool!.execute({ text: 'name,age\nAlice,30\nBob,25' }, ctx);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe('Alice');
      expect(parsed[0].age).toBe('30');
    });
  });

  describe('math tools', () => {
    it('should calculate expression', async () => {
      const tool = toolRegistry.get('calculate');
      const result = await tool!.execute({ expression: '2+2' }, ctx);
      expect(result).toBe('4');
    });

    it('should calculate with math functions', async () => {
      const tool = toolRegistry.get('calculate');
      const result = await tool!.execute({ expression: 'Math.sqrt(16)' }, ctx);
      expect(result).toBe('4');
    });
  });

  describe('echo tool', () => {
    it('should echo message', async () => {
      const tool = toolRegistry.get('echo');
      const result = await tool!.execute({ message: 'hello' }, ctx);
      expect(result).toBe('hello');
    });
  });

  describe('tool registry', () => {
    it('should have all tools registered', () => {
      expect(toolRegistry.get('read_file')).toBeDefined();
      expect(toolRegistry.get('write_file')).toBeDefined();
      expect(toolRegistry.get('list_dir')).toBeDefined();
      expect(toolRegistry.get('delete_file')).toBeDefined();
      expect(toolRegistry.get('web_search')).toBeDefined();
      expect(toolRegistry.get('python')).toBeDefined();
      expect(toolRegistry.get('shell')).toBeDefined();
      expect(toolRegistry.get('http')).toBeDefined();
      expect(toolRegistry.get('json_parse')).toBeDefined();
      expect(toolRegistry.get('csv_parse')).toBeDefined();
      expect(toolRegistry.get('calculate')).toBeDefined();
      expect(toolRegistry.get('echo')).toBeDefined();
    });

    it('should list all tools', () => {
      const tools = toolRegistry.list();
      expect(tools.length).toBe(12);
    });
  });
});
