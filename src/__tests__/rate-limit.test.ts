import { describe, it, expect } from 'vitest';
import { checkRateLimit, getClientIP, rateLimitResponse } from '../utils/rate-limit.js';

describe('rate-limit', () => {
  describe('checkRateLimit', () => {
    it('allows first request in window', () => {
      const result = checkRateLimit('test-ip-1', { windowMs: 60_000, max: 5 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('counts up within window', () => {
      const ip = 'test-ip-counter';
      for (let i = 0; i < 4; i++) {
        checkRateLimit(ip, { windowMs: 60_000, max: 5 });
      }
      const result = checkRateLimit(ip, { windowMs: 60_000, max: 5 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('blocks when max exceeded', () => {
      const ip = 'test-ip-block';
      for (let i = 0; i < 5; i++) {
        checkRateLimit(ip, { windowMs: 60_000, max: 5 });
      }
      const result = checkRateLimit(ip, { windowMs: 60_000, max: 5 });
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('different IPs have separate counters', () => {
      const ip1 = 'test-ip-sep-1';
      const ip2 = 'test-ip-sep-2';
      for (let i = 0; i < 5; i++) {
        checkRateLimit(ip1, { windowMs: 60_000, max: 5 });
      }
      const result = checkRateLimit(ip2, { windowMs: 60_000, max: 5 });
      expect(result.allowed).toBe(true);
    });
  });

  describe('getClientIP', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const req = {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
        socket: { remoteAddress: '127.0.0.1' },
      };
      expect(getClientIP(req)).toBe('1.2.3.4');
    });

    it('falls back to remoteAddress', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.1' },
      };
      expect(getClientIP(req)).toBe('192.168.1.1');
    });

    it('strips ::ffff: prefix', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '::ffff:192.168.1.1' },
      };
      expect(getClientIP(req)).toBe('192.168.1.1');
    });
  });

  describe('rateLimitResponse', () => {
    it('returns 429 with retry-after seconds', () => {
      const result = rateLimitResponse(30_000);
      expect(result.status).toBe(429);
      expect(result.headers['Retry-After']).toBe('30');
      expect(result.headers['X-RateLimit-Remaining']).toBe('0');
    });
  });
});
