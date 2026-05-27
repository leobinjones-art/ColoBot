import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb } from '../src/db/schema.js'
import {
  logHealth,
  logExercise,
  logSleep,
  logWeight,
  logWater,
  getHealthEntries,
  getHealthStats,
} from '../src/life/health.js'

describe('Health', () => {
  beforeEach(() => {
    getDb({ inMemory: true })
  })

  afterEach(() => {
    closeDb()
  })

  describe('logHealth', () => {
    it('should log a health entry', () => {
      const entry = logHealth('user1', 'exercise', 30, 'minutes', 'Running')

      expect(entry.id).toBeDefined()
      expect(entry.userId).toBe('user1')
      expect(entry.type).toBe('exercise')
      expect(entry.value).toBe(30)
      expect(entry.unit).toBe('minutes')
      expect(entry.note).toBe('Running')
      expect(entry.loggedAt).toBeDefined()
    })

    it('should log a health entry without note', () => {
      const entry = logHealth('user1', 'water', 500, 'ml')
      expect(entry.note).toBeUndefined()
    })
  })

  describe('logExercise', () => {
    it('should log exercise with correct type and unit', () => {
      const entry = logExercise('user1', 45, 'Swimming')
      expect(entry.type).toBe('exercise')
      expect(entry.value).toBe(45)
      expect(entry.unit).toBe('minutes')
      expect(entry.note).toBe('Swimming')
    })
  })

  describe('logSleep', () => {
    it('should log sleep with correct type and unit', () => {
      const entry = logSleep('user1', 7.5, 'Good sleep')
      expect(entry.type).toBe('sleep')
      expect(entry.value).toBe(7.5)
      expect(entry.unit).toBe('hours')
    })
  })

  describe('logWeight', () => {
    it('should log weight with correct type and unit', () => {
      const entry = logWeight('user1', 70.5)
      expect(entry.type).toBe('weight')
      expect(entry.value).toBe(70.5)
      expect(entry.unit).toBe('kg')
    })
  })

  describe('logWater', () => {
    it('should log water with correct type and unit', () => {
      const entry = logWater('user1', 250)
      expect(entry.type).toBe('water')
      expect(entry.value).toBe(250)
      expect(entry.unit).toBe('ml')
      expect(entry.note).toBeUndefined()
    })
  })

  describe('getHealthEntries', () => {
    it('should list health entries for a user', () => {
      logExercise('user1', 30)
      logSleep('user1', 8)
      logWater('user1', 500)

      const entries = getHealthEntries('user1')
      expect(entries).toHaveLength(3)
    })

    it('should filter entries by type', () => {
      logExercise('user1', 30)
      logExercise('user1', 45)
      logSleep('user1', 8)

      const entries = getHealthEntries('user1', 'exercise')
      expect(entries).toHaveLength(2)
      expect(entries.every((e) => e.type === 'exercise')).toBe(true)
    })

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        logExercise('user1', i * 10)
      }

      const entries = getHealthEntries('user1', undefined, 3)
      expect(entries).toHaveLength(3)
    })

    it('should return empty array for user with no entries', () => {
      const entries = getHealthEntries('unknown-user')
      expect(entries).toHaveLength(0)
    })

    it('should not return other users entries', () => {
      logExercise('user1', 30)
      logExercise('user2', 45)

      const entries = getHealthEntries('user1')
      expect(entries).toHaveLength(1)
    })
  })

  describe('getHealthStats', () => {
    it('should compute stats across health entries', () => {
      logExercise('user1', 30)
      logExercise('user1', 20)
      logSleep('user1', 7)
      logSleep('user1', 8)
      logWeight('user1', 70)
      logWater('user1', 500)
      logWater('user1', 300)

      const stats = getHealthStats('user1')

      expect(stats.totalExercise).toBe(50)
      expect(stats.avgSleep).toBe(7.5)
      expect(stats.latestWeight).toBe(70)
      expect(stats.totalWater).toBe(800)
    })

    it('should return zeroed stats for user with no entries', () => {
      const stats = getHealthStats('unknown-user')

      expect(stats.totalExercise).toBe(0)
      expect(stats.avgSleep).toBe(0)
      expect(stats.latestWeight).toBeNull()
      expect(stats.totalWater).toBe(0)
    })

    it('should handle entries with only one type', () => {
      logExercise('user1', 60)

      const stats = getHealthStats('user1')

      expect(stats.totalExercise).toBe(60)
      expect(stats.avgSleep).toBe(0)
      expect(stats.latestWeight).toBeNull()
      expect(stats.totalWater).toBe(0)
    })
  })
})
