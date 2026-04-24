/**
 * Auth Middleware 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock process.argv and process.stdin
const originalArgv = process.argv;
const originalEnv = process.env;

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.resetModules();
    process.argv = [...originalArgv];
    process.env = { ...originalEnv };
    delete process.env.COLOBOT_API_KEY;
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  describe('setApiKeys', () => {
    it('should set API keys', async () => {
      const { setApiKeys, hasKeys, isAuthConfigured } = await import('../middleware/auth.js');
      setApiKeys(['key1', 'key2']);
      expect(hasKeys()).toBe(true);
      expect(isAuthConfigured()).toBe(true);
    });

    it('should filter empty keys', async () => {
      const { setApiKeys, hasKeys } = await import('../middleware/auth.js');
      setApiKeys(['key1', '', 'key2']);
      expect(hasKeys()).toBe(true);
    });
  });

  describe('validateKey', () => {
    it('should validate correct key', async () => {
      const { setApiKeys, validateKey } = await import('../middleware/auth.js');
      setApiKeys(['test-key']);
      expect(validateKey('test-key')).toBe(true);
    });

    it('should reject incorrect key', async () => {
      const { setApiKeys, validateKey } = await import('../middleware/auth.js');
      setApiKeys(['test-key']);
      expect(validateKey('wrong-key')).toBe(false);
    });

    it('should allow any key when not configured', async () => {
      vi.resetModules();
      const { validateKey } = await import('../middleware/auth.js');
      expect(validateKey('any-key')).toBe(true);
    });
  });

  describe('requireAuth', () => {
    it('should authenticate with valid Bearer token', async () => {
      const { setApiKeys, requireAuth } = await import('../middleware/auth.js');
      setApiKeys(['secret-key']);

      const ctx = requireAuth({
        headers: { authorization: 'Bearer secret-key' },
      });

      expect(ctx.authenticated).toBe(true);
      expect(ctx.apiKey).toBe('secret-key');
    });

    it('should authenticate with X-API-Key header', async () => {
      const { setApiKeys, requireAuth } = await import('../middleware/auth.js');
      setApiKeys(['secret-key']);

      const ctx = requireAuth({
        headers: { 'x-api-key': 'secret-key' },
      });

      expect(ctx.authenticated).toBe(true);
    });

    it('should reject invalid key', async () => {
      const { setApiKeys, requireAuth } = await import('../middleware/auth.js');
      setApiKeys(['secret-key']);

      expect(() => requireAuth({
        headers: { authorization: 'Bearer wrong-key' },
      })).toThrow('Unauthorized');
    });

    it('should reject missing key when configured', async () => {
      const { setApiKeys, requireAuth } = await import('../middleware/auth.js');
      setApiKeys(['secret-key']);

      expect(() => requireAuth({
        headers: {},
      })).toThrow('Unauthorized');
    });

    it('should allow any request when not configured', async () => {
      vi.resetModules();
      const { requireAuth } = await import('../middleware/auth.js');

      const ctx = requireAuth({
        headers: {},
      });

      expect(ctx.authenticated).toBe(true);
    });
  });

  describe('extractApiKey', () => {
    it('should extract from Authorization Bearer', async () => {
      const { setApiKeys, requireAuth } = await import('../middleware/auth.js');
      setApiKeys(['my-key']);

      const ctx = requireAuth({
        headers: { authorization: 'Bearer my-key' },
      });

      expect(ctx.apiKey).toBe('my-key');
    });

    it('should extract from X-API-Key', async () => {
      const { setApiKeys, requireAuth } = await import('../middleware/auth.js');
      setApiKeys(['my-key']);

      const ctx = requireAuth({
        headers: { 'x-api-key': 'my-key' },
      });

      expect(ctx.apiKey).toBe('my-key');
    });

    it('should handle array headers', async () => {
      const { setApiKeys, requireAuth } = await import('../middleware/auth.js');
      setApiKeys(['my-key']);

      const ctx = requireAuth({
        headers: { 'x-api-key': ['my-key'] },
      });

      expect(ctx.apiKey).toBe('my-key');
    });
  });
});