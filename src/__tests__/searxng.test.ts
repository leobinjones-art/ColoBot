/**
 * SearXNG 搜索模块测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment
vi.stubEnv('SEARXNG_URL', 'http://localhost:8080');

import {
  searxngSearch,
  imageSearch,
  videoSearch,
  newsSearch,
  multimodalSearch,
  academicSearch,
} from '../search/searxng.js';

describe('SearXNG Search', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('searxngSearch', () => {
    it('should return search results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: 'test query',
          number_of_results: 10,
          results: [
            { url: 'https://example.com', title: 'Example', content: 'Test content', engine: 'google', category: 'general' },
          ],
          answers: [],
          suggestions: ['test query 2'],
          infoboxes: [],
        }),
      });

      const result = await searxngSearch('test query');

      expect(result.query).toBe('test query');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Example');
      expect(result.suggestions).toContain('test query 2');
    });

    it('should handle rate limiting (429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const result = await searxngSearch('test');

      expect(result.results).toEqual([]);
      expect(result.numberOfResults).toBe(0);
    });

    it('should handle service unavailable (503)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const result = await searxngSearch('test');

      expect(result.results).toEqual([]);
    });

    it('should throw on other errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(searxngSearch('test')).rejects.toThrow('SearXNG search failed');
    });

    it('should pass search options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: 'test',
          number_of_results: 0,
          results: [],
          answers: [],
          suggestions: [],
          infoboxes: [],
        }),
      });

      await searxngSearch('test', {
        language: 'zh',
        safe_search: 1,
        time_range: 'day',
        categories: ['news'],
        engines: ['google', 'bing'],
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body;

      expect(body).toContain('language=zh');
      expect(body).toContain('safesearch=1');
      expect(body).toContain('time_range=day');
      expect(body).toContain('categories=news');
      expect(body).toContain('engines=google%2Cbing');
    });
  });

  describe('imageSearch', () => {
    it('should search with images category', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: 'cat',
          number_of_results: 5,
          results: [
            { url: 'https://img.com/cat.jpg', title: 'Cat', content: '', engine: 'google images', category: 'images', thumbnail: 'https://thumb.com/cat.jpg' },
          ],
          answers: [],
          suggestions: [],
          infoboxes: [],
        }),
      });

      const result = await imageSearch('cat');

      expect(result.results[0].category).toBe('images');
      expect(result.results[0].thumbnail).toBeDefined();
    });
  });

  describe('videoSearch', () => {
    it('should search with videos category', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: 'tutorial',
          number_of_results: 3,
          results: [
            { url: 'https://youtube.com/watch?v=123', title: 'Tutorial', content: '', engine: 'youtube', category: 'videos' },
          ],
          answers: [],
          suggestions: [],
          infoboxes: [],
        }),
      });

      const result = await videoSearch('tutorial');

      expect(result.results[0].category).toBe('videos');
    });
  });

  describe('newsSearch', () => {
    it('should search with news category', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: 'latest news',
          number_of_results: 10,
          results: [
            { url: 'https://news.com/article', title: 'Breaking News', content: 'News content', engine: 'google news', category: 'news', publishedDate: '2024-01-15' },
          ],
          answers: [],
          suggestions: [],
          infoboxes: [],
        }),
      });

      const result = await newsSearch('latest news');

      expect(result.results[0].category).toBe('news');
      expect(result.results[0].publishedDate).toBeDefined();
    });
  });

  describe('multimodalSearch', () => {
    it('should return both text and image results', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            query: 'apple',
            number_of_results: 5,
            results: [{ url: 'https://apple.com', title: 'Apple', content: 'Tech company', engine: 'google', category: 'general' }],
            answers: [],
            suggestions: [],
            infoboxes: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            query: 'apple',
            number_of_results: 3,
            results: [{ url: 'https://img.com/apple.jpg', title: 'Apple Image', content: '', engine: 'google images', category: 'images' }],
            answers: [],
            suggestions: [],
            infoboxes: [],
          }),
        });

      const result = await multimodalSearch('apple');

      expect(result.text.results).toHaveLength(1);
      expect(result.images.results).toHaveLength(1);
      expect(result.text.results[0].category).toBe('general');
      expect(result.images.results[0].category).toBe('images');
    });
  });

  describe('academicSearch', () => {
    it('should search academic sources', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: 'machine learning',
          number_of_results: 10,
          results: [
            {
              url: 'https://arxiv.org/abs/1234',
              title: 'Deep Learning Paper',
              content: 'Abstract of the paper...',
              engine: 'arxiv',
              category: 'science',
              publishedDate: '2024-01-01',
            },
          ],
          answers: [],
          suggestions: [],
          infoboxes: [],
        }),
      });

      const result = await academicSearch('machine learning');

      expect(result.papers).toHaveLength(1);
      expect(result.papers[0].title).toBe('Deep Learning Paper');
      expect(result.papers[0].source).toBe('arxiv');
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await academicSearch('test');

      expect(result.papers).toEqual([]);
      expect(result.results).toEqual([]);
    });
  });
});
