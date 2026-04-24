/**
 * User Profile Full 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock vector
vi.mock('../memory/vector.js', () => ({
  addMemory: vi.fn(async () => {}),
  searchMemory: vi.fn(async () => []),
}));

import { query, queryOne } from '../memory/db.js';

describe('User Profile Full', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should return null when not found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      const { getUserProfile } = await import('../services/user-profile.js');
      const profile = await getUserProfile('agent-1');

      expect(profile).toBeNull();
    });

    it('should return profile when found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'profile-1',
        agent_id: 'agent-1',
        name: 'Test User',
        role: 'developer',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });

      const { getUserProfile } = await import('../services/user-profile.js');
      const profile = await getUserProfile('agent-1');

      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('Test User');
    });
  });

  describe('upsertUserProfile', () => {
    it('should upsert profile', async () => {
      vi.mocked(query).mockResolvedValueOnce([]);

      const { upsertUserProfile } = await import('../services/user-profile.js');
      await upsertUserProfile('agent-1', { name: 'New User' });

      expect(query).toHaveBeenCalled();
    });
  });

  describe('deleteUserProfile', () => {
    it('should delete profile', async () => {
      vi.mocked(query).mockResolvedValueOnce([]);

      const { deleteUserProfile } = await import('../services/user-profile.js');
      await deleteUserProfile('agent-1');

      expect(query).toHaveBeenCalled();
    });
  });

  describe('buildProfilePrompt', () => {
    it('should return empty string for null', async () => {
      const { buildProfilePrompt } = await import('../services/user-profile.js');
      const prompt = buildProfilePrompt(null);

      expect(prompt).toBe('');
    });

    it('should build prompt for profile', async () => {
      const { buildProfilePrompt } = await import('../services/user-profile.js');
      const prompt = buildProfilePrompt({
        id: 'profile-1',
        agent_id: 'agent-1',
        name: 'Test User',
        role: 'developer',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });

      expect(prompt).toContain('开发者');
    });
  });
});