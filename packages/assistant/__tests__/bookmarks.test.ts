import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb } from '../src/db/schema.js'
import {
  createBookmark,
  getBookmark,
  deleteBookmark,
  listBookmarks,
  searchBookmarks,
} from '../src/knowledge/bookmarks.js'

describe('Bookmarks', () => {
  beforeEach(() => {
    getDb({ inMemory: true })
  })

  afterEach(() => {
    closeDb()
  })

  describe('createBookmark', () => {
    it('should create a bookmark', () => {
      const bm = createBookmark({
        userId: 'user1',
        url: 'https://example.com',
        title: 'Example Site',
        summary: 'A useful website',
        tags: ['reference', 'docs'],
      })

      expect(bm.id).toBeDefined()
      expect(bm.userId).toBe('user1')
      expect(bm.url).toBe('https://example.com')
      expect(bm.title).toBe('Example Site')
      expect(bm.summary).toBe('A useful website')
      expect(bm.tags).toEqual(['reference', 'docs'])
      expect(bm.createdAt).toBeDefined()
    })

    it('should create a bookmark without optional fields', () => {
      const bm = createBookmark({
        userId: 'user1',
        url: 'https://example.com',
        title: 'Example',
      })

      expect(bm.summary).toBeUndefined()
      expect(bm.tags).toEqual([])
    })
  })

  describe('getBookmark', () => {
    it('should retrieve a bookmark by id and userId', () => {
      const created = createBookmark({
        userId: 'user1',
        url: 'https://example.com',
        title: 'Example',
      })
      const fetched = getBookmark(created.id, 'user1')

      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.title).toBe('Example')
    })

    it('should return null for non-existent id', () => {
      const result = getBookmark('nonexistent', 'user1')
      expect(result).toBeNull()
    })

    it('should return null for wrong userId', () => {
      const created = createBookmark({
        userId: 'user1',
        url: 'https://example.com',
        title: 'Example',
      })
      const result = getBookmark(created.id, 'user2')
      expect(result).toBeNull()
    })
  })

  describe('deleteBookmark', () => {
    it('should delete a bookmark', () => {
      const created = createBookmark({
        userId: 'user1',
        url: 'https://example.com',
        title: 'Example',
      })
      const deleted = deleteBookmark(created.id, 'user1')
      expect(deleted).toBe(true)

      const fetched = getBookmark(created.id, 'user1')
      expect(fetched).toBeNull()
    })

    it('should return false for non-existent bookmark', () => {
      const deleted = deleteBookmark('nonexistent', 'user1')
      expect(deleted).toBe(false)
    })

    it('should not delete another users bookmark', () => {
      const created = createBookmark({
        userId: 'user1',
        url: 'https://example.com',
        title: 'Example',
      })
      const deleted = deleteBookmark(created.id, 'user2')
      expect(deleted).toBe(false)

      const fetched = getBookmark(created.id, 'user1')
      expect(fetched).not.toBeNull()
    })
  })

  describe('listBookmarks', () => {
    it('should list bookmarks for a user', () => {
      createBookmark({ userId: 'user1', url: 'https://a.com', title: 'A' })
      createBookmark({ userId: 'user1', url: 'https://b.com', title: 'B' })
      createBookmark({ userId: 'user2', url: 'https://c.com', title: 'C' })

      const list = listBookmarks('user1')
      expect(list).toHaveLength(2)
    })

    it('should filter bookmarks by tag', () => {
      createBookmark({
        userId: 'user1',
        url: 'https://a.com',
        title: 'A',
        tags: ['tech'],
      })
      createBookmark({
        userId: 'user1',
        url: 'https://b.com',
        title: 'B',
        tags: ['design'],
      })

      const list = listBookmarks('user1', 'tech')
      expect(list).toHaveLength(1)
      expect(list[0].title).toBe('A')
    })

    it('should return empty array for user with no bookmarks', () => {
      const list = listBookmarks('unknown-user')
      expect(list).toHaveLength(0)
    })
  })

  describe('searchBookmarks', () => {
    it('should search bookmarks by title', () => {
      createBookmark({ userId: 'user1', url: 'https://a.com', title: 'TypeScript Guide' })
      createBookmark({ userId: 'user1', url: 'https://b.com', title: 'Python Tutorial' })

      const results = searchBookmarks('user1', 'TypeScript')
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('TypeScript Guide')
    })

    it('should search bookmarks by summary', () => {
      createBookmark({
        userId: 'user1',
        url: 'https://a.com',
        title: 'Guide',
        summary: 'A comprehensive TypeScript resource',
      })

      const results = searchBookmarks('user1', 'TypeScript')
      expect(results).toHaveLength(1)
    })

    it('should search bookmarks by url', () => {
      createBookmark({ userId: 'user1', url: 'https://typescript.dev/guide', title: 'Guide' })

      const results = searchBookmarks('user1', 'typescript.dev')
      expect(results).toHaveLength(1)
    })

    it('should return empty results for no match', () => {
      createBookmark({ userId: 'user1', url: 'https://a.com', title: 'Guide' })

      const results = searchBookmarks('user1', 'nonexistent-query')
      expect(results).toHaveLength(0)
    })

    it('should not return other users bookmarks in search', () => {
      createBookmark({ userId: 'user1', url: 'https://a.com', title: 'TypeScript Guide' })
      createBookmark({ userId: 'user2', url: 'https://b.com', title: 'TypeScript Tutorial' })

      const results = searchBookmarks('user1', 'TypeScript')
      expect(results).toHaveLength(1)
    })
  })
})
