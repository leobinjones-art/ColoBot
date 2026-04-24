/**
 * Minimax Tools 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock executor to prevent auto-registration
vi.mock('../agent-runtime/tools/executor.js', () => ({
  registerTool: vi.fn(),
}));

// Mock settings-cache
vi.mock('../services/settings-cache.js', () => ({
  getMinimaxApiKey: vi.fn(() => 'test-api-key'),
  getMinimaxGroupId: vi.fn(() => 'test-group-id'),
  getOpenAIApiKey: vi.fn(() => 'test-key'),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Minimax Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('minimax-tts registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/minimax-tts.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('minimax-video registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/minimax-video.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('minimax-music registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/minimax-music.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('minimax-text registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/minimax-text.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('minimax-file registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/minimax-file.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('minimax-voice registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/minimax-voice.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('minimax-search registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/minimax-search.js');
      expect(() => registerTools()).not.toThrow();
    });
  });
});