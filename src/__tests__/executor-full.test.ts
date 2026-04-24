/**
 * Executor Full 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock settings-cache
vi.mock('../services/settings-cache.js', () => ({
  getMockLLM: vi.fn(() => false),
  getLlmProvider: vi.fn(() => 'openai'),
  getOpenAIApiKey: vi.fn(() => 'test-key'),
}));

describe('Executor Full', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseToolCalls', () => {
    it('should parse empty response', async () => {
      const { parseToolCalls } = await import('../agent-runtime/tools/executor.js');
      const calls = parseToolCalls({ content: '' });

      expect(calls).toEqual([]);
    });

    it('should parse response without tool calls', async () => {
      const { parseToolCalls } = await import('../agent-runtime/tools/executor.js');
      const calls = parseToolCalls({ content: 'Just a normal response' });

      expect(calls).toEqual([]);
    });
  });

  describe('formatToolResults', () => {
    it('should format empty results', async () => {
      const { formatToolResults } = await import('../agent-runtime/tools/executor.js');
      const formatted = formatToolResults([]);

      expect(formatted).toBe('');
    });

    it('should format single result', async () => {
      const { formatToolResults } = await import('../agent-runtime/tools/executor.js');
      const formatted = formatToolResults([{ name: 'test', result: 'success' }]);

      expect(formatted).toContain('test');
    });

    it('should format multiple results', async () => {
      const { formatToolResults } = await import('../agent-runtime/tools/executor.js');
      const formatted = formatToolResults([
        { name: 'search', result: 'found' },
        { name: 'read', result: 'content' },
      ]);

      expect(formatted).toContain('search');
      expect(formatted).toContain('read');
    });
  });

  describe('executeToolCalls', () => {
    it('should execute empty calls', async () => {
      const { executeToolCalls } = await import('../agent-runtime/tools/executor.js');
      const results = await executeToolCalls([], 'agent-1');

      expect(results).toEqual([]);
    });
  });
});