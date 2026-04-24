/**
 * 安全写入测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock poison-defense
vi.mock('../services/poison-defense.js', () => ({
  checkWritePermission: vi.fn(async () => ({ allowed: true })),
  recordPoisoningAttempt: vi.fn(async () => {}),
}));

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock vector
vi.mock('../memory/vector.js', () => ({
  addMemory: vi.fn(async () => {}),
}));

import { checkWritePermission } from '../services/poison-defense.js';
import { query } from '../memory/db.js';
import { addMemory } from '../memory/vector.js';
import {
  safeAddMemory,
  safeUpsertSkill,
} from '../services/safe-write.js';

describe('Safe Write', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('safeAddMemory', () => {
    it('should add memory when allowed', async () => {
      vi.mocked(checkWritePermission).mockResolvedValueOnce({ allowed: true });

      const result = await safeAddMemory('agent-1', 'key-1', 'test content', {});

      expect(result.success).toBe(true);
      expect(addMemory).toHaveBeenCalledWith('agent-1', 'key-1', 'test content', {});
    });

    it('should block when not allowed', async () => {
      vi.mocked(checkWritePermission).mockResolvedValueOnce({
        allowed: false,
        reason: '内容需要人工审核',
      });

      const result = await safeAddMemory('agent-1', 'key-1', 'malicious content', {});

      expect(result.success).toBe(false);
      expect(result.reason).toContain('审核');
    });
  });

  describe('safeUpsertSkill', () => {
    it('should upsert skill when allowed', async () => {
      vi.mocked(checkWritePermission).mockResolvedValueOnce({ allowed: true });
      vi.mocked(query).mockResolvedValueOnce([]);

      const result = await safeUpsertSkill('skill-1', '# Test Skill\n```js\nreturn "hello"\n```', [], {}, 'agent-1');

      expect(result.success).toBe(true);
      expect(query).toHaveBeenCalled();
    });

    it('should block unsafe skill code', async () => {
      vi.mocked(checkWritePermission).mockResolvedValueOnce({
        allowed: false,
        reason: 'Dangerous code detected',
      });

      const result = await safeUpsertSkill('skill-1', '# Malicious\n```js\neval(userInput)\n```', [], {}, 'agent-1');

      expect(result.success).toBe(false);
    });
  });
});