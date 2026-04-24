/**
 * Chat Commands Full 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
}));

vi.mock('../agents/session.js', () => ({
  sessionManager: {
    updateContext: vi.fn(async () => {}),
    get: vi.fn(async () => null),
    getHistory: vi.fn(async () => []),
  },
}));

vi.mock('./compression.js', () => ({
  compressMessages: vi.fn(async (msgs) => msgs),
  estimateMessagesTokens: vi.fn(() => 100),
}));

vi.mock('../services/settings-cache.js', () => ({
  getLlmSettings: vi.fn(async () => ({
    llm_provider: 'openai',
    mock_llm: false,
    openai_api_key: 'test',
  })),
}));

describe('Chat Commands Full', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseCommand', () => {
    it('should parse /new', async () => {
      const { parseCommand } = await import('../agent-runtime/chat-commands.js');
      expect(parseCommand('/new')).toEqual({ command: 'new' });
    });

    it('should parse /reset', async () => {
      const { parseCommand } = await import('../agent-runtime/chat-commands.js');
      expect(parseCommand('/reset')).toEqual({ command: 'reset' });
    });

    it('should parse /compact', async () => {
      const { parseCommand } = await import('../agent-runtime/chat-commands.js');
      expect(parseCommand('/compact')).toEqual({ command: 'compact' });
    });

    it('should parse /model with args', async () => {
      const { parseCommand } = await import('../agent-runtime/chat-commands.js');
      expect(parseCommand('/model gpt-4')).toEqual({ command: 'model', args: 'gpt-4' });
    });

    it('should parse /models', async () => {
      const { parseCommand } = await import('../agent-runtime/chat-commands.js');
      expect(parseCommand('/models')).toEqual({ command: 'models' });
    });

    it('should parse /help', async () => {
      const { parseCommand } = await import('../agent-runtime/chat-commands.js');
      expect(parseCommand('/help')).toEqual({ command: 'help' });
    });

    it('should parse /stop', async () => {
      const { parseCommand } = await import('../agent-runtime/chat-commands.js');
      expect(parseCommand('/stop')).toEqual({ command: 'stop' });
    });

    it('should return null for non-command', async () => {
      const { parseCommand } = await import('../agent-runtime/chat-commands.js');
      expect(parseCommand('hello')).toBeNull();
    });

    it('should return null for invalid command', async () => {
      const { parseCommand } = await import('../agent-runtime/chat-commands.js');
      expect(parseCommand('/invalid')).toBeNull();
    });
  });

  describe('executeCommand', () => {
    const context = { agentId: 'agent-1', sessionKey: 'session-1' };

    it('should execute /new', async () => {
      const { executeCommand } = await import('../agent-runtime/chat-commands.js');
      const result = await executeCommand('new', undefined, context);
      expect(result.success).toBe(true);
    });

    it('should execute /reset', async () => {
      const { executeCommand } = await import('../agent-runtime/chat-commands.js');
      const result = await executeCommand('reset', undefined, context);
      expect(result.success).toBe(true);
    });

    it('should execute /compact', async () => {
      const { executeCommand } = await import('../agent-runtime/chat-commands.js');
      const result = await executeCommand('compact', undefined, context);
      expect(result.success).toBe(true);
    });

    it('should execute /help', async () => {
      const { executeCommand } = await import('../agent-runtime/chat-commands.js');
      const result = await executeCommand('help', undefined, context);
      expect(result.success).toBe(true);
    });

    it('should execute /models', async () => {
      const { executeCommand } = await import('../agent-runtime/chat-commands.js');
      const result = await executeCommand('models', undefined, context);
      expect(result.success).toBe(true);
    });

    it('should execute /stop', async () => {
      const { executeCommand } = await import('../agent-runtime/chat-commands.js');
      const result = await executeCommand('stop', undefined, context);
      expect(result.success).toBe(true);
    });
  });
});