/**
 * Web Search Tool Extended 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock executor
vi.mock('../agent-runtime/tools/executor.js', () => ({
  registerTool: vi.fn((name, handler) => {
    (global as any).__registeredTools = (global as any).__registeredTools || {};
    (global as any).__registeredTools[name] = handler;
  }),
}));

// Mock searxng
vi.mock('../search/searxng.js', () => ({
  searxngSearch: vi.fn(async () => ({
    query: 'test',
    results: [{ title: 'Result 1', url: 'https://example.com', content: 'Content', engine: 'google', category: 'general' }],
    answers: [],
    suggestions: [],
    numberOfResults: 1,
  })),
  imageSearch: vi.fn(async () => ({ query: 'test', results: [], answers: [], suggestions: [], numberOfResults: 0 })),
  videoSearch: vi.fn(async () => ({ query: 'test', results: [], answers: [], suggestions: [], numberOfResults: 0 })),
  academicSearch: vi.fn(async () => ({ query: 'test', results: [], answers: [], suggestions: [], numberOfResults: 0 })),
}));

describe('Web Search Tool Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).__registeredTools = {};
  });

  describe('registerTools', () => {
    it('should register web search tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/web-search.js');
      registerTools();

      expect((global as any).__registeredTools).toBeDefined();
    });

    it('should have web_search tool', async () => {
      const { registerTools } = await import('../agent-runtime/tools/web-search.js');
      registerTools();

      expect((global as any).__registeredTools['web_search']).toBeDefined();
    });

    it('should have image_search tool', async () => {
      const { registerTools } = await import('../agent-runtime/tools/web-search.js');
      registerTools();

      expect((global as any).__registeredTools['image_search']).toBeDefined();
    });

    it('should have video_search tool', async () => {
      const { registerTools } = await import('../agent-runtime/tools/web-search.js');
      registerTools();

      expect((global as any).__registeredTools['video_search']).toBeDefined();
    });
  });

  describe('web_search handler', () => {
    it('should search web', async () => {
      const { registerTools } = await import('../agent-runtime/tools/web-search.js');
      registerTools();

      const handler = (global as any).__registeredTools['web_search'];
      const result = await handler({ query: 'test query' });

      expect(result).toBeDefined();
    });
  });

  describe('image_search handler', () => {
    it('should search images', async () => {
      const { registerTools } = await import('../agent-runtime/tools/web-search.js');
      registerTools();

      const handler = (global as any).__registeredTools['image_search'];
      const result = await handler({ query: 'test image' });

      expect(result).toBeDefined();
    });
  });

  describe('video_search handler', () => {
    it('should search videos', async () => {
      const { registerTools } = await import('../agent-runtime/tools/web-search.js');
      registerTools();

      const handler = (global as any).__registeredTools['video_search'];
      const result = await handler({ query: 'test video' });

      expect(result).toBeDefined();
    });
  });
});