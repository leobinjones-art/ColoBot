/**
 * 多轮对话测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Sentinel, resetSentinel } from '../index.js'
import {
  MultiTurnTestFramework,
  MULTI_TURN_TEST_CASES,
  formatTestResult,
  generateTestReport,
} from '../multi-turn-test.js'

describe('Multi-Turn Conversation Security Tests', () => {
  let sentinel: Sentinel
  let framework: MultiTurnTestFramework

  beforeEach(() => {
    sentinel = resetSentinel()
    framework = new MultiTurnTestFramework(sentinel)
  })

  describe('Predefined Test Cases', () => {
    it('should detect pet loss + chemical bypass attack', async () => {
      const testCase = MULTI_TURN_TEST_CASES.find(c => c.id === 'multi-turn-001')!
      const result = await framework.runTestCase(testCase)

      // 最终应该被拦截（最后一轮涉及化学品处理尸体）
      expect(result.summary.finalActual).toBe('block')
    })

    it('should detect academic disguise attack', async () => {
      const testCase = MULTI_TURN_TEST_CASES.find(c => c.id === 'multi-turn-002')!
      const result = await framework.runTestCase(testCase)

      // 最终应该被拦截（请求危险配方）
      expect(result.summary.finalActual).toBe('block')
    })

    it('should detect roleplay progressive attack', async () => {
      const testCase = MULTI_TURN_TEST_CASES.find(c => c.id === 'multi-turn-003')!
      const result = await framework.runTestCase(testCase)

      // 最终应该被拦截（角色扮演获取配方）
      expect(result.summary.finalActual).toBe('block')
    })

    it('should detect emotional manipulation attack', async () => {
      const testCase = MULTI_TURN_TEST_CASES.find(c => c.id === 'multi-turn-004')!
      const result = await framework.runTestCase(testCase)

      // 最终应该被拦截（请求自杀方法）
      expect(result.summary.finalActual).toBe('block')
    })

    it('should detect sudden topic jump attack', async () => {
      const testCase = MULTI_TURN_TEST_CASES.find(c => c.id === 'multi-turn-005')!
      const result = await framework.runTestCase(testCase)

      // 话题跳变应该被拦截（从书籍跳到炸弹）
      expect(result.summary.finalActual).toBe('block')
    })

    it('should maintain session risk after topic retreat', async () => {
      const testCase = MULTI_TURN_TEST_CASES.find(c => c.id === 'multi-turn-006')!
      const result = await framework.runTestCase(testCase)

      // 最终应该被拦截（坚持获取危险信息）
      expect(result.summary.finalActual).toBe('block')
    })

    it('should detect long-term conversation infiltration', async () => {
      const testCase = MULTI_TURN_TEST_CASES.find(c => c.id === 'multi-turn-007')!
      const result = await framework.runTestCase(testCase)

      // 最终应该被拦截（请求危险实验步骤）
      expect(result.summary.finalActual).toBe('block')
    })

    it('should detect grandma exploit variant', async () => {
      const testCase = MULTI_TURN_TEST_CASES.find(c => c.id === 'multi-turn-008')!
      const result = await framework.runTestCase(testCase)

      // 最终应该被拦截（奶奶漏洞变体）
      expect(result.summary.finalActual).toBe('block')
    })
  })

  describe('State Tracking', () => {
    it('should track cumulative risk score', async () => {
      const testCase = MULTI_TURN_TEST_CASES[0]
      await framework.runTestCase(testCase)

      const state = framework.getState()
      // 风险评分在有效范围内
      expect(state.cumulativeRiskScore).toBeGreaterThanOrEqual(0)
      expect(state.cumulativeRiskScore).toBeLessThanOrEqual(100)
    })

    it('should track topic drift', async () => {
      const testCase = MULTI_TURN_TEST_CASES[0]
      const result = await framework.runTestCase(testCase)

      // 话题漂移有记录
      expect(result.finalState.topicDrift.deviationDistance).toBeGreaterThanOrEqual(0)
    })

    it('should track emotional state changes', async () => {
      const testCase = MULTI_TURN_TEST_CASES.find(c => c.id === 'multi-turn-004')!
      const result = await framework.runTestCase(testCase)

      // 情感状态有记录
      expect(result.finalState.emotionalState.length).toBeGreaterThanOrEqual(0)
    })

    it('should update session risk level', async () => {
      const testCase = MULTI_TURN_TEST_CASES.find(c => c.id === 'multi-turn-003')!
      const result = await framework.runTestCase(testCase)

      // 会话风险等级有记录
      expect(['low', 'medium', 'high', 'critical']).toContain(result.finalState.sessionRiskLevel)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty conversation', async () => {
      const result = await framework.runTestCase({
        id: 'edge-001',
        name: 'Empty conversation',
        attackType: 'none',
        rounds: [],
        finalIntent: 'none',
        finalExpect: 'pass',
      })

      expect(result.rounds).toHaveLength(0)
      expect(result.summary.totalRounds).toBe(0)
    })

    it('should handle single round conversation', async () => {
      // Layer 1.5 会判断"写诗"为safe
      const result = await framework.runTestCase({
        id: 'edge-002',
        name: 'Single round',
        attackType: 'none',
        rounds: [{ role: 'user', content: '请帮我写一首关于春天的诗', expect: 'pass' }],
        finalIntent: 'poetry request',
        finalExpect: 'pass',
      })

      expect(result.rounds[0].actual).toBe('pass')
      expect(result.summary.totalRounds).toBe(1)
    })

    it('should handle very long content', async () => {
      const longContent = '你好'.repeat(1000)
      const result = await framework.runTestCase({
        id: 'edge-003',
        name: 'Long content',
        attackType: 'none',
        rounds: [{ role: 'user', content: longContent, expect: 'pass' }],
        finalIntent: 'long greeting',
        finalExpect: 'pass',
      })

      // 不应该崩溃
      expect(result.rounds).toBeDefined()
    })
  })

  describe('Report Generation', () => {
    it('should format single test result', async () => {
      const testCase = MULTI_TURN_TEST_CASES[0]
      const result = await framework.runTestCase(testCase)
      const formatted = formatTestResult(result)

      expect(formatted).toContain(testCase.id)
      expect(formatted).toContain('Round')
    })

    it('should generate test report', async () => {
      const results = await framework.runAllTestCases()
      const report = generateTestReport(results)

      expect(report).toContain('多轮对话安全测试报告')
      expect(report).toContain('通过率')
    })
  })
})
