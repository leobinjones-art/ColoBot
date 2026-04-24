/**
 * Web Search Tool 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock executor
vi.mock('../agent-runtime/tools/executor.js', () => ({
  registerTool: vi.fn(),
}));

// Mock searxng
vi.mock('../search/searxng.js', () => ({
  searxngSearch: vi.fn(async () => ({
    query: 'test',
    results: [{ title: 'Result 1', url: 'https://example.com', content: 'Content' }],
    answers: [],
    suggestions: [],
    numberOfResults: 1,
  })),
  imageSearch: vi.fn(async () => ({ query: 'test', results: [], answers: [], suggestions: [], numberOfResults: 0 })),
  videoSearch: vi.fn(async () => ({ query: 'test', results: [], answers: [], suggestions: [], numberOfResults: 0 })),
  academicSearch: vi.fn(async () => ({ query: 'test', results: [], answers: [], suggestions: [], numberOfResults: 0 })),
}));

describe('Web Search Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerTools', () => {
    it('should register web search tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/web-search.js');
      expect(() => registerTools()).not.toThrow();
    });
  });
});