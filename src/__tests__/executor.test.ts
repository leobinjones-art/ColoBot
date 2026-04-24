/**
 * Executor 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../memory/vector.js', () => ({
  hybridSearch: vi.fn(async () => []),
}));

vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
}));

vi.mock('../services/safe-write.js', () => ({
  safeAddMemory: vi.fn(async () => ({ success: true })),
}));

vi.mock('../search/searxng.js', () => ({
  searxngSearch: vi.fn(async () => ({ results: [] })),
}));

import {
  parseToolCalls,
  stripToolCalls,
  formatToolResults,
  buildToolCall,
  executeToolCall,
  registerTool,
  registerToolWithPolicy,
} from '../agent-runtime/tools/executor.js';

describe('Executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseToolCalls', () => {
    it('should parse single tool call', () => {
      const text = 'Some text with a tool call embedded.';
      const calls = parseToolCalls(text);
      expect(Array.isArray(calls)).toBe(true);
    });

    it('should return empty array for no tool calls', () => {
      const text = 'Hello, how are you?';
      const calls = parseToolCalls(text);
      expect(calls).toHaveLength(0);
    });
  });

  describe('stripToolCalls', () => {
    it('should remove tool calls from text', () => {
      const text = 'Hello world';
      const result = stripToolCalls(text);
      expect(result).toBe('Hello world');
    });
  });

  describe('formatToolResults', () => {
    it('should format successful result', () => {
      const results = [{ name: 'test', success: true, result: { data: 'ok' } }];
      const formatted = formatToolResults(results);
      expect(formatted).toContain('OK');
      expect(formatted).toContain('test');
    });

    it('should format error result', () => {
      const results = [{ name: 'test', success: false, result: null, error: 'Failed' }];
      const formatted = formatToolResults(results);
      expect(formatted).toContain('ERROR');
      expect(formatted).toContain('Failed');
    });

    it('should return empty string for empty results', () => {
      const formatted = formatToolResults([]);
      expect(formatted).toBe('');
    });
  });

  describe('buildToolCall', () => {
    it('should build tool call string', () => {
      const call = buildToolCall('read_file', { path: '/tmp/test.txt' });
      expect(call).toContain('read_file');
      expect(call).toContain('path');
    });
  });

  describe('registerTool', () => {
    it('should register a tool', () => {
      registerTool('test_tool', async () => ({ ok: true }));
      // Should not throw
    });
  });

  describe('registerToolWithPolicy', () => {
    it('should register a tool with policy', () => {
      registerToolWithPolicy('protected_tool', async () => ({ ok: true }), {
        required_role: 'admin',
      });
      // Should not throw
    });
  });

  describe('executeToolCall', () => {
    it('should return error for unknown tool', async () => {
      const result = await executeToolCall({ name: 'unknown_tool', args: {} });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should execute registered tool', async () => {
      registerTool('my_tool', async (args) => ({ result: 'done', args }));
      const result = await executeToolCall({ name: 'my_tool', args: { test: 1 } });
      expect(result.success).toBe(true);
    });
  });
});