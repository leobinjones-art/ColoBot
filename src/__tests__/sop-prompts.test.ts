/**
 * SOP Prompts 配置测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
}))

import {
  SOP_PROMPTS,
  getSopPrompt,
  fillPrompt,
  getSopPromptAsync,
  getAllSopPrompts,
} from '../config/sop-prompts.js'

describe('SOP Prompts Config', () => {
  describe('SOP_PROMPTS', () => {
    it('should have all required prompt types', () => {
      expect(SOP_PROMPTS.taskAnalysis).toBeDefined()
      expect(SOP_PROMPTS.stepGuidance).toBeDefined()
      expect(SOP_PROMPTS.summarizeSubAgent).toBeDefined()
      expect(SOP_PROMPTS.reviewStep).toBeDefined()
      expect(SOP_PROMPTS.finalOutput).toBeDefined()
    })

    it('should have placeholders in prompts', () => {
      expect(SOP_PROMPTS.taskAnalysis).toContain('{userMessage}')
      expect(SOP_PROMPTS.stepGuidance).toContain('{taskName}')
      expect(SOP_PROMPTS.summarizeSubAgent).toContain('{subAgentResult}')
      expect(SOP_PROMPTS.reviewStep).toContain('{userData}')
      expect(SOP_PROMPTS.finalOutput).toContain('{stepSummaries}')
    })
  })

  describe('getSopPrompt', () => {
    it('should return default prompt when no env var', () => {
      const prompt = getSopPrompt('taskAnalysis')
      expect(prompt).toBe(SOP_PROMPTS.taskAnalysis)
    })

    it('should return env var override if set', () => {
      process.env.SOP_PROMPT_TASKANALYSIS = 'custom prompt'
      const prompt = getSopPrompt('taskAnalysis')
      expect(prompt).toBe('custom prompt')
      delete process.env.SOP_PROMPT_TASKANALYSIS
    })
  })

  describe('fillPrompt', () => {
    it('should fill placeholders with values', () => {
      const template = 'Hello {name}, your task is {task}'
      const result = fillPrompt(template, { name: 'Alice', task: 'coding' })
      expect(result).toBe('Hello Alice, your task is coding')
    })

    it('should handle missing placeholders', () => {
      const template = 'Hello {name}, your task is {task}'
      const result = fillPrompt(template, { name: 'Alice' })
      expect(result).toBe('Hello Alice, your task is ')
    })

    it('should handle numeric values', () => {
      const template = 'Step {step} of {total}'
      const result = fillPrompt(template, { step: 1, total: 10 })
      expect(result).toBe('Step 1 of 10')
    })
  })

  describe('getSopPromptAsync', () => {
    it('should return default prompt when DB empty', async () => {
      const prompt = await getSopPromptAsync('taskAnalysis')
      expect(prompt).toBe(SOP_PROMPTS.taskAnalysis)
    })
  })

  describe('getAllSopPrompts', () => {
    it('should return all prompts with source info', async () => {
      const prompts = await getAllSopPrompts()
      expect(prompts.taskAnalysis).toBeDefined()
      expect(prompts.taskAnalysis.value).toBeDefined()
      expect(['db', 'env', 'default']).toContain(prompts.taskAnalysis.source)
    })
  })
})