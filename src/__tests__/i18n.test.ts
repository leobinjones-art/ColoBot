/**
 * i18n 国际化测试
 */

import { describe, it, expect } from 'vitest'
import { detectLocale, getMessages, zhMessages, enMessages } from '../i18n/index.js'

describe('i18n', () => {
  describe('detectLocale', () => {
    it('should detect Chinese text', () => {
      expect(detectLocale('你好世界')).toBe('zh')
      expect(detectLocale('这是一个测试')).toBe('zh')
      expect(detectLocale('开始学术研究')).toBe('zh')
    })

    it('should detect English text', () => {
      expect(detectLocale('Hello World')).toBe('en')
      expect(detectLocale('This is a test')).toBe('en')
      expect(detectLocale('Start research')).toBe('en')
    })

    it('should handle mixed text', () => {
      expect(detectLocale('Hello 世界')).toBe('zh')
      expect(detectLocale('Test 测试')).toBe('zh')
    })

    it('should handle empty text', () => {
      expect(detectLocale('')).toBe('en')
    })
  })

  describe('getMessages', () => {
    it('should return Chinese messages for zh', () => {
      const messages = getMessages('zh')
      expect(messages).toBe(zhMessages)
    })

    it('should return English messages for en', () => {
      const messages = getMessages('en')
      expect(messages).toBe(enMessages)
    })
  })

  describe('zhMessages', () => {
    it('should have all SOP messages', () => {
      expect(zhMessages.sop.cancelled).toBeDefined()
      expect(zhMessages.sop.paused).toBeInstanceOf(Function)
      expect(zhMessages.sop.resumed).toBeInstanceOf(Function)
      expect(zhMessages.sop.completed).toBeDefined()
      expect(zhMessages.sop.purposeSelection).toBeInstanceOf(Function)
    })

    it('should have all error messages', () => {
      expect(zhMessages.errors.messageBlocked).toBeDefined()
      expect(zhMessages.errors.noApprovalRequest).toBeInstanceOf(Function)
    })

    it('should have all command messages', () => {
      expect(zhMessages.commands.modelSwitch).toBeInstanceOf(Function)
    })

    it('should return correct format for function messages', () => {
      expect(zhMessages.sop.paused(1, 5)).toContain('1')
      expect(zhMessages.sop.paused(1, 5)).toContain('5')
      expect(zhMessages.sop.stepRejected('test reason')).toContain('test reason')
    })
  })

  describe('enMessages', () => {
    it('should have all SOP messages', () => {
      expect(enMessages.sop.cancelled).toBeDefined()
      expect(enMessages.sop.paused).toBeInstanceOf(Function)
      expect(enMessages.sop.resumed).toBeInstanceOf(Function)
      expect(enMessages.sop.completed).toBeDefined()
    })

    it('should return correct format for function messages', () => {
      expect(enMessages.sop.paused(1, 5)).toContain('1')
      expect(enMessages.sop.paused(1, 5)).toContain('5')
    })
  })

  describe('message consistency', () => {
    it('should have matching keys between zh and en', () => {
      const zhKeys = Object.keys(zhMessages.sop)
      const enKeys = Object.keys(enMessages.sop)
      expect(zhKeys.sort()).toEqual(enKeys.sort())
    })
  })
})