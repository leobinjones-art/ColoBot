/**
 * User Profile Extended 测试
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

describe('User Profile Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserProfile with full data', () => {
    it('should return complete profile', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'profile-1',
        agent_id: 'agent-1',
        name: 'Test User',
        role: 'researcher',
        organization: 'Test University',
        bio: 'AI researcher',
        expertise_level: 'expert',
        research_fields: '["NLP", "ML"]',
        skills: '["Python", "PyTorch"]',
        languages: '["en", "zh"]',
        communication_style: 'formal',
        response_length: 'detailed',
        preferred_language: 'en',
        goals: '["Publish papers"]',
        current_projects: '["Project A"]',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });

      const { getUserProfile } = await import('../services/user-profile.js');
      const profile = await getUserProfile('agent-1');

      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('Test User');
      expect(profile?.role).toBe('researcher');
    });
  });

  describe('upsertUserProfile with all fields', () => {
    it('should upsert complete profile', async () => {
      vi.mocked(query).mockResolvedValueOnce([]);

      const { upsertUserProfile } = await import('../services/user-profile.js');
      await upsertUserProfile('agent-1', {
        name: 'New User',
        role: 'student',
        organization: 'Test School',
        bio: 'Learning AI',
        expertise_level: 'beginner',
        research_fields: ['AI'],
        skills: ['Python'],
        languages: ['en'],
        communication_style: 'casual',
        response_length: 'brief',
        preferred_language: 'en',
        goals: ['Learn ML'],
        current_projects: [],
      });

      expect(query).toHaveBeenCalled();
    });
  });

  describe('buildProfilePrompt with full profile', () => {
    it('should build detailed prompt', async () => {
      const { buildProfilePrompt } = await import('../services/user-profile.js');
      const prompt = buildProfilePrompt({
        id: 'profile-1',
        agent_id: 'agent-1',
        name: 'Test User',
        role: 'developer',
        organization: 'Tech Corp',
        bio: 'Full-stack developer',
        expertise_level: 'intermediate',
        research_fields: ['Web Dev'],
        skills: ['TypeScript', 'React'],
        languages: ['en'],
        communication_style: 'technical',
        response_length: 'detailed',
        preferred_language: 'en',
        goals: ['Build great apps'],
        current_projects: ['Project X'],
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });

      expect(prompt).toContain('开发者');
    });
  });
});