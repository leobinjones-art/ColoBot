/**
 * Safe Write Extended 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock embeddings
vi.mock('../memory/embeddings.js', () => ({
  embed: vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], model: 'mock' })),
}));

// Mock poison-defense
vi.mock('../services/poison-defense.js', () => ({
  checkWritePermission: vi.fn(async () => ({ allowed: true })),
  recordPoisoningAttempt: vi.fn(async () => {}),
}));

// Mock vector
vi.mock('../memory/vector.js', () => ({
  addMemory: vi.fn(async () => {}),
  upsertSkill: vi.fn(async () => {}),
  upsertKnowledge: vi.fn(async () => {}),
  upsertRule: vi.fn(async () => {}),
}));

// Mock user-profile
vi.mock('../services/user-profile.js', () => ({
  upsertUserProfile: vi.fn(async () => {}),
}));

describe('Safe Write Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('safeAddMemory', () => {
    it('should add memory safely', async () => {
      const { safeAddMemory } = await import('../services/safe-write.js');
      const result = await safeAddMemory('agent-1', 'test-key', 'Test memory content');

      expect(result.success).toBe(true);
    });
  });

  describe('safeUpsertSkill', () => {
    it('should upsert skill safely', async () => {
      const { safeUpsertSkill } = await import('../services/safe-write.js');
      const result = await safeUpsertSkill('Test skill', 'Skill content');

      expect(result.success).toBe(true);
    });
  });

  describe('safeUpsertUserProfile', () => {
    it('should upsert user profile safely', async () => {
      const { safeUpsertUserProfile } = await import('../services/safe-write.js');
      const result = await safeUpsertUserProfile('agent-1', { name: 'Test User' });

      expect(result.success).toBe(true);
    });
  });

  describe('safeUpsertKnowledge', () => {
    it('should upsert knowledge safely', async () => {
      const { safeUpsertKnowledge } = await import('../services/safe-write.js');
      const result = await safeUpsertKnowledge('agent-1', 'Test knowledge', 'Knowledge content');

      expect(result.success).toBe(true);
    });
  });

  describe('safeUpsertRule', () => {
    it('should upsert rule safely', async () => {
      const { safeUpsertRule } = await import('../services/safe-write.js');
      const result = await safeUpsertRule('agent-1', 'Test rule', 'Rule content');

      expect(result.success).toBe(true);
    });
  });
});