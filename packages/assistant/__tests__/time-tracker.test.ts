import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { getDb, closeDb } from '../src/db/schema.js'
import {
  startTimeLog,
  endTimeLog,
  getTimeLog,
  getActiveTimeLogs,
  getTimeLogs,
  getTimeStats,
  deleteTimeLog,
} from '../src/tools/time-tracker.js'

describe('Time Tracker', () => {
  let db: Database.Database

  beforeEach(() => {
    db = getDb({ inMemory: true })
  })

  afterEach(() => {
    closeDb()
  })

  describe('startTimeLog', () => {
    it('should start a time log', () => {
      const log = startTimeLog('user1', 'Coding', 'work', 'building feature')

      expect(log.id).toBeDefined()
      expect(log.userId).toBe('user1')
      expect(log.activity).toBe('Coding')
      expect(log.category).toBe('work')
      expect(log.note).toBe('building feature')
      expect(log.startedAt).toBeDefined()
      expect(log.endedAt).toBeUndefined()
      expect(log.durationMinutes).toBeUndefined()
    })

    it('should start a time log without optional fields', () => {
      const log = startTimeLog('user1', 'Reading')

      expect(log.category).toBeUndefined()
      expect(log.note).toBeUndefined()
    })
  })

  describe('endTimeLog', () => {
    it('should end an active time log', () => {
      const log = startTimeLog('user1', 'Coding', 'work')

      // Manually set started_at to a known past time so duration is deterministic
      db.prepare(`UPDATE assistant_time_logs SET started_at = ? WHERE id = ?`).run(
        new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        log.id,
      )

      const ended = endTimeLog(log.id, 'user1')
      expect(ended).not.toBeNull()
      expect(ended!.endedAt).toBeDefined()
      expect(ended!.durationMinutes).toBeGreaterThanOrEqual(0)
    })

    it('should return null when ending a non-existent time log', () => {
      const result = endTimeLog('nonexistent-id', 'user1')
      expect(result).toBeNull()
    })

    it('should return null when ending an already-ended time log', () => {
      const log = startTimeLog('user1', 'Coding')
      endTimeLog(log.id, 'user1')
      const secondEnd = endTimeLog(log.id, 'user1')
      expect(secondEnd).toBeNull()
    })

    it('should not end another users time log', () => {
      const log = startTimeLog('user1', 'Coding')
      const result = endTimeLog(log.id, 'user2')
      expect(result).toBeNull()
    })
  })

  describe('getTimeLog', () => {
    it('should retrieve a time log by id and userId', () => {
      const created = startTimeLog('user1', 'Coding', 'work', 'feature work')
      const fetched = getTimeLog(created.id, 'user1')

      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.activity).toBe('Coding')
    })

    it('should return null for non-existent id', () => {
      const result = getTimeLog('nonexistent', 'user1')
      expect(result).toBeNull()
    })

    it('should return null for wrong userId', () => {
      const created = startTimeLog('user1', 'Coding')
      const result = getTimeLog(created.id, 'user2')
      expect(result).toBeNull()
    })
  })

  describe('getActiveTimeLogs', () => {
    it('should return only active (not ended) time logs', () => {
      startTimeLog('user1', 'Task A')
      startTimeLog('user1', 'Task B')
      const ended = startTimeLog('user1', 'Task C')
      endTimeLog(ended.id, 'user1')

      const active = getActiveTimeLogs('user1')
      expect(active).toHaveLength(2)
      expect(active.every((l) => l.endedAt === undefined)).toBe(true)
    })

    it('should return empty array when no active logs', () => {
      const active = getActiveTimeLogs('user1')
      expect(active).toHaveLength(0)
    })

    it('should not return other users active logs', () => {
      startTimeLog('user1', 'Task A')
      startTimeLog('user2', 'Task B')

      const active = getActiveTimeLogs('user1')
      expect(active).toHaveLength(1)
      expect(active[0].activity).toBe('Task A')
    })
  })

  describe('getTimeLogs', () => {
    it('should list time logs for a user', () => {
      startTimeLog('user1', 'Task A')
      startTimeLog('user1', 'Task B')
      startTimeLog('user2', 'Task C')

      const logs = getTimeLogs('user1')
      expect(logs).toHaveLength(2)
    })

    it('should filter by date range', () => {
      startTimeLog('user1', 'Task A')

      // Manually insert a log with a past date
      const id = Date.now() + '-test'
      db.prepare(
        `INSERT INTO assistant_time_logs (id, user_id, activity, started_at) VALUES (?, ?, ?, ?)`,
      ).run(id, 'user1', 'Old Task', '2020-01-01T00:00:00.000Z')

      const logs = getTimeLogs('user1', '2024-01-01')
      expect(logs).toHaveLength(1)
      expect(logs[0].activity).toBe('Task A')
    })

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        startTimeLog('user1', `Task ${i}`)
      }

      const logs = getTimeLogs('user1', undefined, undefined, 3)
      expect(logs).toHaveLength(3)
    })

    it('should return empty array for user with no logs', () => {
      const logs = getTimeLogs('unknown-user')
      expect(logs).toHaveLength(0)
    })
  })

  describe('getTimeStats', () => {
    it('should compute stats across ended time logs', () => {
      const log1 = startTimeLog('user1', 'Coding', 'work')
      db.prepare(`UPDATE assistant_time_logs SET started_at = ? WHERE id = ?`).run(
        new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        log1.id,
      )
      endTimeLog(log1.id, 'user1')

      const log2 = startTimeLog('user1', 'Reading', 'leisure')
      db.prepare(`UPDATE assistant_time_logs SET started_at = ? WHERE id = ?`).run(
        new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        log2.id,
      )
      endTimeLog(log2.id, 'user1')

      const stats = getTimeStats('user1')

      expect(stats.totalMinutes).toBeGreaterThanOrEqual(0)
      expect(stats.byCategory).toBeDefined()
      expect(stats.byActivity).toBeDefined()
      expect(stats.byActivity['Coding']).toBeGreaterThanOrEqual(0)
      expect(stats.byActivity['Reading']).toBeGreaterThanOrEqual(0)
    })

    it('should return zeroed stats for user with no ended logs', () => {
      startTimeLog('user1', 'Active Task')

      const stats = getTimeStats('user1')
      expect(stats.totalMinutes).toBe(0)
      expect(Object.keys(stats.byCategory)).toHaveLength(0)
      expect(Object.keys(stats.byActivity)).toHaveLength(0)
    })

    it('should return zeroed stats for unknown user', () => {
      const stats = getTimeStats('unknown-user')
      expect(stats.totalMinutes).toBe(0)
    })
  })

  describe('deleteTimeLog', () => {
    it('should delete a time log', () => {
      const log = startTimeLog('user1', 'Coding')
      const deleted = deleteTimeLog(log.id, 'user1')
      expect(deleted).toBe(true)

      const fetched = getTimeLog(log.id, 'user1')
      expect(fetched).toBeNull()
    })

    it('should return false for non-existent log', () => {
      const deleted = deleteTimeLog('nonexistent', 'user1')
      expect(deleted).toBe(false)
    })

    it('should not delete another users log', () => {
      const log = startTimeLog('user1', 'Coding')
      const deleted = deleteTimeLog(log.id, 'user2')
      expect(deleted).toBe(false)

      const fetched = getTimeLog(log.id, 'user1')
      expect(fetched).not.toBeNull()
    })
  })
})
