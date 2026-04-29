/**
 * User Profile 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}))

// Mock vector
vi.mock('../memory/vector.js', () => ({
  addMemory: vi.fn(async () => {}),
  searchMemory: vi.fn(async () => []),
}))

import { query, queryOne } from '../memory/db.js'
import {
  getUserProfile,
  upsertUserProfile,
  deleteUserProfile,
  buildProfilePrompt,
} from '../services/user-profile.js'

describe('User Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserProfile', () => {
    it('should return null when profile not found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null)

      const profile = await getUserProfile('agent-1')

      expect(profile).toBeNull()
    })

    it('should return profile when found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'profile-1',
        agent_id: 'agent-1',
        name: 'Test User',
        role: 'developer',
        organization: 'Test Org',
        bio: 'Test bio',
        expertise_level: 'intermediate',
        research_fields: '["AI", "ML"]',
        skills: '["Python", "TypeScript"]',
        languages: '["en", "zh"]',
        communication_style: 'casual',
        response_length: 'detailed',
        preferred_language: 'en',
        goals: '["Learn AI"]',
        current_projects: '["Project X"]',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      })

      const profile = await getUserProfile('agent-1')

      expect(profile).not.toBeNull()
      expect(profile?.name).toBe('Test User')
      expect(profile?.role).toBe('developer')
    })
  })

  describe('upsertUserProfile', () => {
    it('should create or update profile', async () => {
      vi.mocked(query).mockResolvedValueOnce([])

      await upsertUserProfile('agent-1', {
        name: 'New User',
        role: 'student',
      })

      expect(query).toHaveBeenCalled()
    })
  })

  describe('deleteUserProfile', () => {
    it('should delete profile', async () => {
      vi.mocked(query).mockResolvedValueOnce([])

      await deleteUserProfile('agent-1')

      expect(query).toHaveBeenCalled()
    })
  })

  describe('buildProfilePrompt', () => {
    it('should return empty string for null profile', () => {
      const prompt = buildProfilePrompt(null)
      expect(prompt).toBe('')
    })

    it('should build prompt from profile', () => {
      const prompt = buildProfilePrompt({
        id: 'profile-1',
        agent_id: 'agent-1',
        name: 'Test User',
        role: 'developer',
        expertise_level: 'intermediate',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      })

      expect(prompt).toContain('开发者')
      expect(prompt).toContain('经验')
    })
  })
})
