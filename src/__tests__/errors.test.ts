/**
 * 错误处理工具测试
 */

import { describe, it, expect } from 'vitest'
import {
  ErrorCode,
  ColoBotError,
  createError,
  isColoBotError,
  getErrorCode,
  isRecoverable,
  formatErrorMessage,
  safeExecute,
  executeWithRetry,
} from '../utils/errors.js'

describe('Error Utils', () => {
  describe('createError', () => {
    it('should create ColoBotError with code and message', () => {
      const error = createError(ErrorCode.NOT_FOUND, 'Resource not found')
      expect(error).toBeInstanceOf(ColoBotError)
      expect(error.code).toBe(ErrorCode.NOT_FOUND)
      expect(error.message).toBe('Resource not found')
    })

    it('should create error with details', () => {
      const error = createError(ErrorCode.INVALID_INPUT, 'Invalid input', {
        details: { field: 'name' },
      })
      expect(error.details).toEqual({ field: 'name' })
    })

    it('should create recoverable error', () => {
      const error = createError(ErrorCode.LLM_RATE_LIMIT, 'Rate limit', {
        recoverable: true,
      })
      expect(error.recoverable).toBe(true)
    })
  })

  describe('isColoBotError', () => {
    it('should return true for ColoBotError', () => {
      const error = createError(ErrorCode.UNKNOWN, 'test')
      expect(isColoBotError(error)).toBe(true)
    })

    it('should return false for regular Error', () => {
      const error = new Error('test')
      expect(isColoBotError(error)).toBe(false)
    })

    it('should return false for non-error', () => {
      expect(isColoBotError('string')).toBe(false)
      expect(isColoBotError(null)).toBe(false)
    })
  })

  describe('getErrorCode', () => {
    it('should return code for ColoBotError', () => {
      const error = createError(ErrorCode.NOT_FOUND, 'test')
      expect(getErrorCode(error)).toBe(ErrorCode.NOT_FOUND)
    })

    it('should return UNKNOWN for regular error', () => {
      expect(getErrorCode(new Error('test'))).toBe(ErrorCode.UNKNOWN)
    })
  })

  describe('isRecoverable', () => {
    it('should return true for recoverable error', () => {
      const error = createError(ErrorCode.LLM_RATE_LIMIT, 'test', { recoverable: true })
      expect(isRecoverable(error)).toBe(true)
    })

    it('should return false for non-recoverable error', () => {
      const error = createError(ErrorCode.NOT_FOUND, 'test')
      expect(isRecoverable(error)).toBe(false)
    })

    it('should return false for regular error', () => {
      expect(isRecoverable(new Error('test'))).toBe(false)
    })
  })

  describe('formatErrorMessage', () => {
    it('should format error in Chinese', () => {
      const error = createError(ErrorCode.NOT_FOUND, 'test')
      expect(formatErrorMessage(error, 'zh')).toContain('不存在')
    })

    it('should format error in English', () => {
      const error = createError(ErrorCode.NOT_FOUND, 'test')
      expect(formatErrorMessage(error, 'en')).toContain('not found')
    })

    it('should include details in message', () => {
      const error = createError(ErrorCode.INVALID_INPUT, 'test', {
        details: { field: 'name' },
      })
      const msg = formatErrorMessage(error, 'zh')
      expect(msg).toContain('field')
    })

    it('should handle regular Error', () => {
      const error = new Error('Custom error message')
      expect(formatErrorMessage(error, 'zh')).toBe('Custom error message')
    })
  })

  describe('safeExecute', () => {
    it('should return result on success', async () => {
      const result = await safeExecute(() => Promise.resolve('success'), 'fallback')
      expect(result).toBe('success')
    })

    it('should return fallback on error', async () => {
      const result = await safeExecute(
        () => Promise.reject(new Error('fail')),
        'fallback'
      )
      expect(result).toBe('fallback')
    })

    it('should call onError callback', async () => {
      let called = false
      await safeExecute(
        () => Promise.reject(new Error('fail')),
        'fallback',
        () => {
          called = true
        }
      )
      expect(called).toBe(true)
    })
  })

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const result = await executeWithRetry(() => Promise.resolve('success'))
      expect(result).toBe('success')
    })

    it('should retry on failure', async () => {
      let attempts = 0
      const result = await executeWithRetry(() => {
        attempts++
        if (attempts < 3) {
          return Promise.reject(new Error('fail'))
        }
        return Promise.resolve('success')
      })
      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('should throw after max retries', async () => {
      await expect(
        executeWithRetry(() => Promise.reject(new Error('always fail')), {
          maxRetries: 2,
          delayMs: 10,
        })
      ).rejects.toThrow('always fail')
    })

    it('should respect shouldRetry callback', async () => {
      let attempts = 0
      await expect(
        executeWithRetry(
          () => {
            attempts++
            return Promise.reject(new Error('no retry'))
          },
          {
            maxRetries: 3,
            delayMs: 10,
            shouldRetry: () => false,
          }
        )
      ).rejects.toThrow('no retry')
      expect(attempts).toBe(1)
    })
  })
})