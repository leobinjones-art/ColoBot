import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb } from '../src/db/schema.js'
import {
  addReading,
  updateReadingProgress,
  getReading,
  listReadings,
  deleteReading,
} from '../src/growth/reading.js'

describe('Reading', () => {
  beforeEach(() => {
    getDb({ inMemory: true })
  })

  afterEach(() => {
    closeDb()
  })

  describe('addReading', () => {
    it('should add a reading item', () => {
      const item = addReading('user1', 'Clean Code', 'book', 'Robert C. Martin')

      expect(item.id).toBeDefined()
      expect(item.userId).toBe('user1')
      expect(item.title).toBe('Clean Code')
      expect(item.author).toBe('Robert C. Martin')
      expect(item.type).toBe('book')
      expect(item.status).toBe('pending')
      expect(item.progress).toBe(0)
      expect(item.createdAt).toBeDefined()
    })

    it('should add a reading item with default type', () => {
      const item = addReading('user1', 'Some Article')
      expect(item.type).toBe('book') // default
    })

    it('should add a reading item without author', () => {
      const item = addReading('user1', 'Blog Post', 'article')
      expect(item.author).toBeUndefined()
    })

    it('should add different types of reading items', () => {
      const book = addReading('user1', 'Book Title', 'book')
      const article = addReading('user1', 'Article Title', 'article')
      const paper = addReading('user1', 'Paper Title', 'paper')

      expect(book.type).toBe('book')
      expect(article.type).toBe('article')
      expect(paper.type).toBe('paper')
    })
  })

  describe('getReading', () => {
    it('should retrieve a reading item by id and userId', () => {
      const created = addReading('user1', 'Clean Code', 'book', 'Robert C. Martin')
      const fetched = getReading(created.id, 'user1')

      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.title).toBe('Clean Code')
      expect(fetched!.author).toBe('Robert C. Martin')
    })

    it('should return null for non-existent id', () => {
      const result = getReading('nonexistent', 'user1')
      expect(result).toBeNull()
    })

    it('should return null for wrong userId', () => {
      const created = addReading('user1', 'Clean Code')
      const result = getReading(created.id, 'user2')
      expect(result).toBeNull()
    })
  })

  describe('updateReadingProgress', () => {
    it('should update progress and set status to reading', () => {
      const item = addReading('user1', 'Clean Code')
      const updated = updateReadingProgress(item.id, 'user1', 50)

      expect(updated).not.toBeNull()
      expect(updated!.progress).toBe(50)
      expect(updated!.status).toBe('reading')
    })

    it('should set status to done when progress reaches 100', () => {
      const item = addReading('user1', 'Clean Code')
      const updated = updateReadingProgress(item.id, 'user1', 100)

      expect(updated!.progress).toBe(100)
      expect(updated!.status).toBe('done')
    })

    it('should set status to done when progress exceeds 100', () => {
      const item = addReading('user1', 'Clean Code')
      const updated = updateReadingProgress(item.id, 'user1', 150)

      expect(updated!.progress).toBe(150)
      expect(updated!.status).toBe('done')
    })

    it('should keep status as pending when progress is 0', () => {
      const item = addReading('user1', 'Clean Code')
      updateReadingProgress(item.id, 'user1', 50)
      // Progress can't go back to 0 in normal flow, but test with 0 directly
      const item2 = addReading('user1', 'Another Book')
      const updated = updateReadingProgress(item2.id, 'user1', 0)

      expect(updated!.progress).toBe(0)
      expect(updated!.status).toBe('pending')
    })

    it('should update note when provided', () => {
      const item = addReading('user1', 'Clean Code')
      const updated = updateReadingProgress(item.id, 'user1', 50, 'Great so far')

      expect(updated!.note).toBe('Great so far')
    })

    it('should preserve existing note when no new note provided', () => {
      const item = addReading('user1', 'Clean Code')
      updateReadingProgress(item.id, 'user1', 50, 'First note')
      const updated = updateReadingProgress(item.id, 'user1', 75)

      expect(updated!.note).toBe('First note')
    })

    it('should return null for non-existent reading', () => {
      const result = updateReadingProgress('nonexistent', 'user1', 50)
      expect(result).toBeNull()
    })

    it('should not update another users reading', () => {
      const item = addReading('user1', 'Clean Code')
      const result = updateReadingProgress(item.id, 'user2', 50)
      expect(result).toBeNull()

      const fetched = getReading(item.id, 'user1')
      expect(fetched!.progress).toBe(0)
    })
  })

  describe('listReadings', () => {
    it('should list reading items for a user', () => {
      addReading('user1', 'Book A')
      addReading('user1', 'Book B')
      addReading('user2', 'Book C')

      const list = listReadings('user1')
      expect(list).toHaveLength(2)
    })

    it('should filter by status', () => {
      addReading('user1', 'Pending Book')
      const item = addReading('user1', 'Reading Book')
      updateReadingProgress(item.id, 'user1', 50)

      const pending = listReadings('user1', 'pending')
      expect(pending).toHaveLength(1)
      expect(pending[0].title).toBe('Pending Book')

      const reading = listReadings('user1', 'reading')
      expect(reading).toHaveLength(1)
      expect(reading[0].title).toBe('Reading Book')
    })

    it('should return empty array for user with no readings', () => {
      const list = listReadings('unknown-user')
      expect(list).toHaveLength(0)
    })
  })

  describe('deleteReading', () => {
    it('should delete a reading item', () => {
      const item = addReading('user1', 'Clean Code')
      const deleted = deleteReading(item.id, 'user1')
      expect(deleted).toBe(true)

      const fetched = getReading(item.id, 'user1')
      expect(fetched).toBeNull()
    })

    it('should return false for non-existent reading', () => {
      const deleted = deleteReading('nonexistent', 'user1')
      expect(deleted).toBe(false)
    })

    it('should not delete another users reading', () => {
      const item = addReading('user1', 'Clean Code')
      const deleted = deleteReading(item.id, 'user2')
      expect(deleted).toBe(false)

      const fetched = getReading(item.id, 'user1')
      expect(fetched).not.toBeNull()
    })
  })
})
