/**
 * Agent Tools 测试
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
  getLlmProvider: vi.fn(() => 'openai'),
}));

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock vector
vi.mock('../memory/vector.js', () => ({
  addMemory: vi.fn(async () => {}),
  searchMemory: vi.fn(async () => []),
  upsertSkill: vi.fn(async () => {}),
  upsertKnowledge: vi.fn(async () => {}),
  upsertRule: vi.fn(async () => {}),
}));

describe('Agent Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('install-skill registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/install-skill.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('exec-code registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/exec-code.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('subagent registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/subagent.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('workspace registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/workspace.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('knowledge registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/knowledge.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('uninstall registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/uninstall.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('import-soul registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/import-soul.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('agent-tools registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/agent-tools.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('memory registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/memory.js');
      expect(() => registerTools()).not.toThrow();
    });
  });

  describe('web-search registerTools', () => {
    it('should register tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/web-search.js');
      expect(() => registerTools()).not.toThrow();
    });
  });
});