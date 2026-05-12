/**
 * 法律条文学习器测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LegalLearner, resetLegalLearner } from '../legal-learner.js'
import { rm } from 'fs/promises'
import { existsSync } from 'fs'

describe('LegalLearner', () => {
  let learner: LegalLearner
  const testStoragePath = './test-legal-docs'

  beforeEach(() => {
    learner = resetLegalLearner({ storagePath: testStoragePath })
  })

  afterEach(async () => {
    if (existsSync(testStoragePath)) {
      await rm(testStoragePath, { recursive: true })
    }
  })

  describe('learn', () => {
    it('should learn a legal document without LLM', async () => {
      const result = await learner.learn(
        '中华人民共和国动物防疫法',
        '第二十一条',
        '动物尸体应当按照国家规定进行无害化处理，不得随意丢弃。'
      )

      expect(result.success).toBe(true)
      expect(result.document?.law).toBe('中华人民共和国动物防疫法')
      expect(result.document?.keywords.length).toBeGreaterThan(0)
      expect(result.document?.tags).toContain('动物')
    })

    it('should not duplicate learned documents', async () => {
      await learner.learn('测试法', '第一条', '测试内容')
      await learner.learn('测试法', '第一条', '测试内容')

      const all = learner.getAll()
      expect(all.length).toBe(1)
    })
  })

  describe('learnBatch', () => {
    it('should learn multiple documents', async () => {
      const count = await learner.learnBatch([
        { law: '测试法A', article: '第一条', content: '内容A' },
        { law: '测试法B', article: '第二条', content: '内容B' },
      ])

      expect(count).toBe(2)
      expect(learner.getAll().length).toBe(2)
    })
  })

  describe('search', () => {
    it('should search by keywords', async () => {
      await learner.learn(
        '动物防疫法',
        '第二十一条',
        '动物尸体应当按照国家规定进行无害化处理，不得随意丢弃。'
      )

      const results = learner.search('动物尸体')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].law).toBe('动物防疫法')
    })

    it('should return empty for no match', async () => {
      await learner.learn('测试法', '第一条', '测试内容')

      const results = learner.search('完全不相关的内容xyz')
      expect(results.length).toBe(0)
    })
  })

  describe('getByTags', () => {
    it('should filter by tags', async () => {
      await learner.learn('动物防疫法', '第一条', '动物相关内容')

      const results = learner.getByTags(['动物'])
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('load', () => {
    it('should load previously saved documents', async () => {
      await learner.learn('测试法', '第一条', '测试内容')

      // 创建新实例并加载
      const newLearner = resetLegalLearner({ storagePath: testStoragePath })
      const count = await newLearner.load()

      expect(count).toBe(1)
      expect(newLearner.getAll().length).toBe(1)
    })
  })

  describe('delete', () => {
    it('should delete a document', async () => {
      const result = await learner.learn('测试法', '第一条', '测试内容')
      const id = result.document!.id

      const deleted = await learner.delete(id)
      expect(deleted).toBe(true)
      expect(learner.getAll().length).toBe(0)
    })
  })
})
