import { describe, it, expect } from 'vitest'
import {
  AppError,
  UserError,
  AuthError,
  NotFoundError,
  RateLimitError,
  LLMError,
  DatabaseError,
  NetworkError,
  toAppError,
  getFriendlyMessage,
  ErrorCodes,
} from '../index.js'

describe('Errors', () => {
  describe('AppError', () => {
    it('should create base error', () => {
      const error = new AppError('Test error')
      expect(error.message).toBe('Test error')
      expect(error.category).toBe('internal_error')
      expect(error.statusCode).toBe(500)
    })

    it('should convert to JSON', () => {
      const error = new AppError('Test', 'user_error', 'TEST', 400, { field: 'name' })
      const json = error.toJSON()

      expect(json.error).toBe(true)
      expect(json.category).toBe('user_error')
      expect(json.code).toBe('TEST')
      expect(json.details).toEqual({ field: 'name' })
    })
  })

  describe('Specialized errors', () => {
    it('should create UserError', () => {
      const error = new UserError('Invalid input')
      expect(error.category).toBe('user_error')
      expect(error.statusCode).toBe(400)
    })

    it('should create AuthError', () => {
      const error = new AuthError()
      expect(error.category).toBe('auth_error')
      expect(error.statusCode).toBe(401)
    })

    it('should create NotFoundError', () => {
      const error = new NotFoundError('User')
      expect(error.message).toBe('User 不存在')
      expect(error.statusCode).toBe(404)
    })

    it('should create RateLimitError', () => {
      const error = new RateLimitError(60)
      expect(error.category).toBe('rate_limit')
      expect(error.statusCode).toBe(429)
      expect(error.details?.retryAfter).toBe(60)
    })

    it('should create LLMError', () => {
      const error = new LLMError('API failed', 'openai')
      expect(error.category).toBe('llm_error')
      expect(error.details?.provider).toBe('openai')
    })

    it('should create DatabaseError', () => {
      const error = new DatabaseError()
      expect(error.category).toBe('database_error')
      expect(error.statusCode).toBe(503)
    })

    it('should create NetworkError', () => {
      const error = new NetworkError()
      expect(error.category).toBe('network_error')
      expect(error.statusCode).toBe(503)
    })
  })

  describe('toAppError', () => {
    it('should return AppError as is', () => {
      const error = new UserError('Test')
      const result = toAppError(error)
      expect(result).toBe(error)
    })

    it('should convert Error to AppError', () => {
      const error = new Error('api key invalid')
      const result = toAppError(error)
      expect(result).toBeInstanceOf(LLMError)
    })

    it('should convert rate limit error', () => {
      const error = new Error('rate limit exceeded')
      const result = toAppError(error)
      expect(result).toBeInstanceOf(RateLimitError)
    })

    it('should convert unknown to AppError', () => {
      const result = toAppError('string error')
      expect(result).toBeInstanceOf(AppError)
      expect(result.message).toBe('未知错误')
    })
  })

  describe('getFriendlyMessage', () => {
    it('should return friendly message for known errors', () => {
      const error = new Error('invalid_api_key')
      expect(getFriendlyMessage(error)).toBe('API Key 无效，请检查配置')
    })

    it('should return AppError message directly', () => {
      const error = new UserError('自定义错误')
      expect(getFriendlyMessage(error)).toBe('自定义错误')
    })

    it('should return default message for unknown errors', () => {
      const error = new Error('unknown error')
      expect(getFriendlyMessage(error)).toBe('发生错误，请稍后再试')
    })
  })

  describe('ErrorCodes', () => {
    it('should have defined error codes', () => {
      expect(ErrorCodes.INVALID_INPUT).toBe('INVALID_INPUT')
      expect(ErrorCodes.AUTH_FAILED).toBe('AUTH_FAILED')
      expect(ErrorCodes.LLM_API_KEY_INVALID).toBe('LLM_API_KEY_INVALID')
      expect(ErrorCodes.CAPABILITY_DENIED).toBe('CAPABILITY_DENIED')
    })
  })
})
