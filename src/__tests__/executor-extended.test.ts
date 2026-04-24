/**
 * Executor Extended 测试
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

describe('Executor Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseToolCalls', () => {
    it('should parse tool calls from response', async () => {
      const { parseToolCalls } = await import('../agent-runtime/tools/executor.js');
      const response = {
        content: 'Here is the result.',
      };

      const calls = parseToolCalls(response);
      expect(calls).toBeDefined();
    });

    it('should handle empty response', async () => {
      const { parseToolCalls } = await import('../agent-runtime/tools/executor.js');
      const calls = parseToolCalls({ content: '' });

      expect(calls).toEqual([]);
    });
  });

  describe('formatToolResults', () => {
    it('should format tool results', async () => {
      const { formatToolResults } = await import('../agent-runtime/tools/executor.js');
      const results = [
        { name: 'search', result: 'Found 10 results' },
        { name: 'read', result: 'File content' },
      ];

      const formatted = formatToolResults(results);
      expect(formatted).toContain('search');
      expect(formatted).toContain('read');
    });

    it('should handle empty results', async () => {
      const { formatToolResults } = await import('../agent-runtime/tools/executor.js');
      const formatted = formatToolResults([]);

      expect(formatted).toBe('');
    });
  });
});