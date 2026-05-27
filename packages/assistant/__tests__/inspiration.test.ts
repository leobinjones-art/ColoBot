import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb } from '../src/db/schema.js'
import {
  addInspiration,
  getInspiration,
  listInspirations,
  searchInspirations,
  deleteInspiration,
} from '../src/growth/inspiration.js'

describe('Inspiration', () => {
  beforeEach(() => {
    getDb({ inMemory: true })
  })

  afterEach(() => {
    closeDb()
  })

  describe('addInspiration', () => {
    it('should add an inspiration', () => {
      const insp = addInspiration('user1', 'Build something useful today', ['coding', 'motivation'])

      expect(insp.id).toBeDefined()
      expect(insp.userId).toBe('user1')
      expect(insp.content).toBe('Build something useful today')
      expect(insp.tags).toEqual(['coding', 'motivation'])
      expect(insp.createdAt).toBeDefined()
    })

    it('should add an inspiration without tags', () => {
      const insp = addInspiration('user1', 'A fleeting thought')

      expect(insp.tags).toEqual([])
    })
  })

  describe('getInspiration', () => {
    it('should retrieve an inspiration by id and userId', () => {
      const created = addInspiration('user1', 'A great idea', ['idea'])
      const fetched = getInspiration(created.id, 'user1')

      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.content).toBe('A great idea')
      expect(fetched!.tags).toEqual(['idea'])
    })

    it('should return null for non-existent id', () => {
      const result = getInspiration('nonexistent', 'user1')
      expect(result).toBeNull()
    })

    it('should return null for wrong userId', () => {
      const created = addInspiration('user1', 'A great idea')
      const result = getInspiration(created.id, 'user2')
      expect(result).toBeNull()
    })
  })

  describe('listInspirations', () => {
    it('should list inspirations for a user', () => {
      addInspiration('user1', 'Idea A')
      addInspiration('user1', 'Idea B')
      addInspiration('user2', 'Idea C')

      const list = listInspirations('user1')
      expect(list).toHaveLength(2)
    })

    it('should filter inspirations by tag', () => {
      addInspiration('user1', 'Idea A', ['design'])
      addInspiration('user1', 'Idea B', ['coding'])
      addInspiration('user1', 'Idea C', ['design', 'coding'])

      const designList = listInspirations('user1', 'design')
      expect(designList).toHaveLength(2)

      const codingList = listInspirations('user1', 'coding')
      expect(codingList).toHaveLength(2)
    })

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        addInspiration('user1', `Idea ${i}`)
      }

      const list = listInspirations('user1', undefined, 3)
      expect(list).toHaveLength(3)
    })

    it('should return empty array for user with no inspirations', () => {
      const list = listInspirations('unknown-user')
      expect(list).toHaveLength(0)
    })
  })

  describe('searchInspirations', () => {
    it('should search inspirations by content', () => {
      addInspiration('user1', 'Build a new feature')
      addInspiration('user1', 'Design a new logo')
      addInspiration('user1', 'Write documentation')

      const results = searchInspirations('user1', 'feature')
      expect(results).toHaveLength(1)
      expect(results[0].content).toBe('Build a new feature')
    })

    it('should return partial matches', () => {
      addInspiration('user1', 'Refactor the authentication module')
      addInspiration('user1', 'Add authentication tests')

      const results = searchInspirations('user1', 'authentication')
      expect(results).toHaveLength(2)
    })

    it('should return empty results for no match', () => {
      addInspiration('user1', 'A random thought')

      const results = searchInspirations('user1', 'nonexistent-query')
      expect(results).toHaveLength(0)
    })

    it('should not return other users inspirations in search', () => {
      addInspiration('user1', 'Shared idea concept')
      addInspiration('user2', 'Shared idea concept')

      const results = searchInspirations('user1', 'Shared idea')
      expect(results).toHaveLength(1)
      expect(results[0].userId).toBe('user1')
    })
  })

  describe('deleteInspiration', () => {
    it('should delete an inspiration', () => {
      const insp = addInspiration('user1', 'A temporary idea')
      const deleted = deleteInspiration(insp.id, 'user1')
      expect(deleted).toBe(true)

      const fetched = getInspiration(insp.id, 'user1')
      expect(fetched).toBeNull()
    })

    it('should return false for non-existent inspiration', () => {
      const deleted = deleteInspiration('nonexistent', 'user1')
      expect(deleted).toBe(false)
    })

    it('should not delete another users inspiration', () => {
      const insp = addInspiration('user1', 'My idea')
      const deleted = deleteInspiration(insp.id, 'user2')
      expect(deleted).toBe(false)

      const fetched = getInspiration(insp.id, 'user1')
      expect(fetched).not.toBeNull()
    })
  })
})
