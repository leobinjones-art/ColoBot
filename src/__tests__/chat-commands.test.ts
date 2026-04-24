/**
 * Chat Commands 测试
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
    anthropic_api_key: '',
    minimax_api_key: '',
  })),
}));

import { parseCommand, executeCommand } from '../agent-runtime/chat-commands.js';

describe('Chat Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseCommand', () => {
    it('should parse /new command', () => {
      const result = parseCommand('/new');
      expect(result).toEqual({ command: 'new' });
    });

    it('should parse /reset command', () => {
      const result = parseCommand('/reset');
      expect(result).toEqual({ command: 'reset' });
    });

    it('should parse /compact command', () => {
      const result = parseCommand('/compact');
      expect(result).toEqual({ command: 'compact' });
    });

    it('should parse /model with args', () => {
      const result = parseCommand('/model gpt-4');
      expect(result).toEqual({ command: 'model', args: 'gpt-4' });
    });

    it('should parse /models command', () => {
      const result = parseCommand('/models');
      expect(result).toEqual({ command: 'models' });
    });

    it('should parse /reasoning with args', () => {
      const result = parseCommand('/reasoning on');
      expect(result).toEqual({ command: 'reasoning', args: 'on' });
    });

    it('should parse /thinking with args', () => {
      const result = parseCommand('/thinking high');
      expect(result).toEqual({ command: 'thinking', args: 'high' });
    });

    it('should parse /stop command', () => {
      const result = parseCommand('/stop');
      expect(result).toEqual({ command: 'stop' });
    });

    it('should parse /help command', () => {
      const result = parseCommand('/help');
      expect(result).toEqual({ command: 'help' });
    });

    it('should parse /approval with args', () => {
      const result = parseCommand('/approval abc123 approve');
      expect(result).toEqual({ command: 'approval', args: 'abc123 approve' });
    });

    it('should parse /approvals command', () => {
      const result = parseCommand('/approvals');
      expect(result).toEqual({ command: 'approvals' });
    });

    it('should parse /pending command', () => {
      const result = parseCommand('/pending');
      expect(result).toEqual({ command: 'pending' });
    });

    it('should return null for non-command', () => {
      const result = parseCommand('hello world');
      expect(result).toBeNull();
    });

    it('should return null for invalid command', () => {
      const result = parseCommand('/invalid');
      expect(result).toBeNull();
    });

    it('should handle leading/trailing whitespace', () => {
      const result = parseCommand('  /new  ');
      expect(result).toEqual({ command: 'new' });
    });
  });

  describe('executeCommand', () => {
    const context = {
      agentId: 'agent-1',
      sessionKey: 'session-1',
    };

    it('should execute /new command', async () => {
      const result = await executeCommand('new', undefined, context);
      expect(result.success).toBe(true);
      expect(result.action).toBe('new');
    });

    it('should execute /reset command', async () => {
      const result = await executeCommand('reset', undefined, context);
      expect(result.success).toBe(true);
      expect(result.action).toBe('reset');
    });

    it('should execute /compact command', async () => {
      const result = await executeCommand('compact', undefined, context);
      expect(result.success).toBe(true);
      expect(result.action).toBe('compact');
    });

    it('should execute /model command without args', async () => {
      const result = await executeCommand('model', undefined, context);
      expect(result.success).toBe(true);
      expect(result.action).toBe('model');
    });

    it('should execute /model command with args', async () => {
      const result = await executeCommand('model', 'gpt-4', context);
      expect(result.success).toBe(true);
      expect(result.data?.requestedModel).toBe('gpt-4');
    });

    it('should execute /models command', async () => {
      const result = await executeCommand('models', undefined, context);
      expect(result.success).toBe(true);
      expect(result.action).toBe('models');
    });

    it('should execute /reasoning command without args', async () => {
      const result = await executeCommand('reasoning', undefined, context);
      expect(result.success).toBe(true);
    });

    it('should execute /reasoning on', async () => {
      const result = await executeCommand('reasoning', 'on', context);
      expect(result.success).toBe(true);
      expect(result.data?.reasoningEnabled).toBe(true);
    });

    it('should execute /reasoning off', async () => {
      const result = await executeCommand('reasoning', 'off', context);
      expect(result.success).toBe(true);
      expect(result.data?.reasoningEnabled).toBe(false);
    });

    it('should execute /thinking command without args', async () => {
      const result = await executeCommand('thinking', undefined, context);
      expect(result.success).toBe(true);
    });

    it('should execute /thinking high', async () => {
      const result = await executeCommand('thinking', 'high', context);
      expect(result.success).toBe(true);
      expect(result.data?.thinkingLevel).toBe('high');
    });

    it('should reject invalid thinking level', async () => {
      const result = await executeCommand('thinking', 'invalid', context);
      expect(result.success).toBe(false);
    });

    it('should execute /stop command', async () => {
      const result = await executeCommand('stop', undefined, context);
      expect(result.success).toBe(true);
      expect(result.action).toBe('stop');
    });

    it('should execute /stop with callback', async () => {
      const stopStreaming = vi.fn();
      const result = await executeCommand('stop', undefined, { ...context, stopStreaming });
      expect(result.success).toBe(true);
      expect(stopStreaming).toHaveBeenCalled();
    });

    it('should execute /help command', async () => {
      const result = await executeCommand('help', undefined, context);
      expect(result.success).toBe(true);
      expect(result.message).toContain('对话指令帮助');
    });

    it('should execute /approval without args', async () => {
      const result = await executeCommand('approval', undefined, context);
      expect(result.success).toBe(false);
    });

    it('should execute /approval with invalid action', async () => {
      const result = await executeCommand('approval', 'abc123 invalid', context);
      expect(result.success).toBe(false);
    });
  });
});