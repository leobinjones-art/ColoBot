import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb } from '../src/db/schema.js'
import {
  createCourse,
  updateProgress,
  getCourse,
  listCourses,
  deleteCourse,
} from '../src/growth/learning.js'

describe('Learning', () => {
  beforeEach(() => {
    getDb({ inMemory: true })
  })

  afterEach(() => {
    closeDb()
  })

  describe('createCourse', () => {
    it('should create a course', () => {
      const course = createCourse('user1', 'TypeScript Mastery', 40)

      expect(course.id).toBeDefined()
      expect(course.userId).toBe('user1')
      expect(course.name).toBe('TypeScript Mastery')
      expect(course.totalHours).toBe(40)
      expect(course.completedHours).toBe(0)
      expect(course.status).toBe('active')
      expect(course.createdAt).toBeDefined()
    })

    it('should create a course with default totalHours', () => {
      const course = createCourse('user1', 'Self-directed Learning')

      expect(course.totalHours).toBe(0)
      expect(course.completedHours).toBe(0)
    })
  })

  describe('getCourse', () => {
    it('should retrieve a course by id and userId', () => {
      const created = createCourse('user1', 'TypeScript', 40)
      const fetched = getCourse(created.id, 'user1')

      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.name).toBe('TypeScript')
    })

    it('should return null for non-existent id', () => {
      const result = getCourse('nonexistent', 'user1')
      expect(result).toBeNull()
    })

    it('should return null for wrong userId', () => {
      const created = createCourse('user1', 'TypeScript', 40)
      const result = getCourse(created.id, 'user2')
      expect(result).toBeNull()
    })
  })

  describe('updateProgress', () => {
    it('should add completed hours to a course', () => {
      const course = createCourse('user1', 'TypeScript', 40)
      const updated = updateProgress(course.id, 'user1', 10)

      expect(updated).not.toBeNull()
      expect(updated!.completedHours).toBe(10)
      expect(updated!.status).toBe('active')
    })

    it('should accumulate progress across multiple updates', () => {
      const course = createCourse('user1', 'TypeScript', 40)
      updateProgress(course.id, 'user1', 10)
      const updated = updateProgress(course.id, 'user1', 15)

      expect(updated!.completedHours).toBe(25)
    })

    it('should mark course as completed when totalHours reached', () => {
      const course = createCourse('user1', 'TypeScript', 20)
      const updated = updateProgress(course.id, 'user1', 20)

      expect(updated!.completedHours).toBe(20)
      expect(updated!.status).toBe('completed')
    })

    it('should mark course as completed when progress exceeds totalHours', () => {
      const course = createCourse('user1', 'TypeScript', 20)
      const updated = updateProgress(course.id, 'user1', 25)

      expect(updated!.completedHours).toBe(25)
      expect(updated!.status).toBe('completed')
    })

    it('should return null for non-existent course', () => {
      const result = updateProgress('nonexistent', 'user1', 5)
      expect(result).toBeNull()
    })

    it('should not update another users course', () => {
      const course = createCourse('user1', 'TypeScript', 40)
      const result = updateProgress(course.id, 'user2', 5)
      expect(result).toBeNull()

      const fetched = getCourse(course.id, 'user1')
      expect(fetched!.completedHours).toBe(0)
    })
  })

  describe('listCourses', () => {
    it('should list courses for a user', () => {
      createCourse('user1', 'TypeScript')
      createCourse('user1', 'Rust')
      createCourse('user2', 'Python')

      const courses = listCourses('user1')
      expect(courses).toHaveLength(2)
    })

    it('should filter courses by status', () => {
      createCourse('user1', 'Active Course', 40)
      const course = createCourse('user1', 'Completing Course', 10)
      updateProgress(course.id, 'user1', 10)

      const active = listCourses('user1', 'active')
      expect(active).toHaveLength(1)
      expect(active[0].name).toBe('Active Course')

      const completed = listCourses('user1', 'completed')
      expect(completed).toHaveLength(1)
      expect(completed[0].name).toBe('Completing Course')
    })

    it('should return empty array for user with no courses', () => {
      const courses = listCourses('unknown-user')
      expect(courses).toHaveLength(0)
    })
  })

  describe('deleteCourse', () => {
    it('should delete a course', () => {
      const course = createCourse('user1', 'TypeScript', 40)
      const deleted = deleteCourse(course.id, 'user1')
      expect(deleted).toBe(true)

      const fetched = getCourse(course.id, 'user1')
      expect(fetched).toBeNull()
    })

    it('should return false for non-existent course', () => {
      const deleted = deleteCourse('nonexistent', 'user1')
      expect(deleted).toBe(false)
    })

    it('should not delete another users course', () => {
      const course = createCourse('user1', 'TypeScript', 40)
      const deleted = deleteCourse(course.id, 'user2')
      expect(deleted).toBe(false)

      const fetched = getCourse(course.id, 'user1')
      expect(fetched).not.toBeNull()
    })
  })
})
