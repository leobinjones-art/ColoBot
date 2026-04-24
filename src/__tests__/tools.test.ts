/**
 * Tool Modules 测试 - 统一测试所有工具注册
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock executor - capture registered tools
const registeredTools = new Map<string, Function>();
vi.mock('../agent-runtime/tools/executor.js', () => ({
  registerTool: vi.fn((name: string, fn: Function) => {
    registeredTools.set(name, fn);
  }),
  registerToolWithPolicy: vi.fn((name: string, fn: Function) => {
    registeredTools.set(name, fn);
  }),
}));

// Mock all external dependencies
vi.mock('../memory/vector.js', () => ({
  hybridSearch: vi.fn(async () => []),
  addMemory: vi.fn(async () => {}),
  listMemory: vi.fn(async () => []),
}));

vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

vi.mock('../search/searxng.js', () => ({
  searxngSearch: vi.fn(async () => ({ query: '', results: [], answers: [], suggestions: [], numberOfResults: 0 })),
  imageSearch: vi.fn(async () => ({ query: '', results: [], answers: [], suggestions: [], numberOfResults: 0 })),
  videoSearch: vi.fn(async () => ({ query: '', results: [], answers: [], suggestions: [], numberOfResults: 0 })),
  academicSearch: vi.fn(async () => ({ query: '', results: [], answers: [], suggestions: [], numberOfResults: 0, papers: [] })),
}));

vi.mock('../services/safe-write.js', () => ({
  safeAddMemory: vi.fn(async () => ({ success: true })),
  safeUpsertSkill: vi.fn(async () => ({ success: true })),
}));

vi.mock('./subagent.js', () => ({
  createSubAgent: vi.fn(async () => ({ id: 'sub-1' })),
  runSubAgent: vi.fn(async () => ({ result: 'done' })),
}));

describe('Tool Modules Registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools.clear();
  });

  describe('memory tools', () => {
    it('should register memory tools', async () => {
      const mod = await import('../agent-runtime/tools/memory.js');
      mod.registerTools();
      expect(registeredTools.has('search_memory') || registeredTools.has('add_memory') || registeredTools.has('list_memory')).toBe(true);
    });
  });

  describe('web-search tools', () => {
    it('should register web search tools', async () => {
      const mod = await import('../agent-runtime/tools/web-search.js');
      mod.registerTools();
      expect(registeredTools.has('web_search') || registeredTools.has('get_time')).toBe(true);
    });
  });

  describe('workspace tools', () => {
    it('should register workspace tools', async () => {
      const mod = await import('../agent-runtime/tools/workspace.js');
      mod.registerTools();
      // Should register without error
    });
  });

  describe('knowledge tools', () => {
    it('should register knowledge tools', async () => {
      const mod = await import('../agent-runtime/tools/knowledge.js');
      mod.registerTools();
      // Should register without error
    });
  });

  describe('send-message tools', () => {
    it('should register send-message tools', async () => {
      const mod = await import('../agent-runtime/tools/send-message.js');
      mod.registerTools();
      // Should register without error
    });
  });

  describe('agent-tools', () => {
    it('should register agent tools', async () => {
      const mod = await import('../agent-runtime/tools/agent-tools.js');
      mod.registerTools();
      // Should register without error
    });
  });

  describe('exec-code tools', () => {
    it('should register exec-code tools', async () => {
      const mod = await import('../agent-runtime/tools/exec-code.js');
      mod.registerTools();
      // Should register without error
    });
  });

  describe('import-soul tools', () => {
    it('should register import-soul tools', async () => {
      const mod = await import('../agent-runtime/tools/import-soul.js');
      mod.registerTools();
      // Should register without error
    });
  });

  describe('install-skill tools', () => {
    it('should register install-skill tools', async () => {
      const mod = await import('../agent-runtime/tools/install-skill.js');
      mod.registerTools();
      // Should register without error
    });
  });

  describe('uninstall tools', () => {
    it('should register uninstall tools', async () => {
      const mod = await import('../agent-runtime/tools/uninstall.js');
      mod.registerTools();
      // Should register without error
    });
  });

  describe('minimax tools', () => {
    it('should register minimax-text tools', async () => {
      const mod = await import('../agent-runtime/tools/minimax-text.js');
      mod.registerTools();
      // Should register without error
    });

    it('should register minimax-voice tools', async () => {
      const mod = await import('../agent-runtime/tools/minimax-voice.js');
      mod.registerTools();
      // Should register without error
    });

    it('should register minimax-tts tools', async () => {
      const mod = await import('../agent-runtime/tools/minimax-tts.js');
      mod.registerTools();
      // Should register without error
    });

    it('should register minimax-music tools', async () => {
      const mod = await import('../agent-runtime/tools/minimax-music.js');
      mod.registerTools();
      // Should register without error
    });

    it('should register minimax-video tools', async () => {
      const mod = await import('../agent-runtime/tools/minimax-video.js');
      mod.registerTools();
      // Should register without error
    });

    it('should register minimax-file tools', async () => {
      const mod = await import('../agent-runtime/tools/minimax-file.js');
      mod.registerTools();
      // Should register without error
    });

    it('should register minimax-search tools', async () => {
      const mod = await import('../agent-runtime/tools/minimax-search.js');
      mod.registerTools();
      // Should register without error
    });
  });

  describe('openclaw tools', () => {
    it('should parse OpenClaw soul', async () => {
      const { parseOpenClawSoul } = await import('../agent-runtime/tools/openclaw.js');
      const result = parseOpenClawSoul('# Test Role\n## Core Identity\nTest personality', 'test');
      expect(result.role).toBe('Test Role');
      expect(result.source).toBe('openclaw');
    });
  });

  describe('clawhub-compat tools', () => {
    it('should load clawhub-compat module', async () => {
      await import('../agent-runtime/tools/clawhub-compat.js');
      // Should load without error
    });
  });

  describe('subagent tools', () => {
    it('should register subagent tools', async () => {
      const mod = await import('../agent-runtime/tools/subagent.js');
      mod.registerTools();
      // Should register without error
    });
  });
});