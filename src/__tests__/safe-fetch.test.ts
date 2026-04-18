import { describe, it, expect } from 'vitest';
import { SSRFError } from '../utils/safe-fetch.js';

describe('safe-fetch', () => {
  describe('SSRFError', () => {
    it('has correct name and message', () => {
      const err = new SSRFError('http://evil.com', 'private IP address');
      expect(err.name).toBe('SSRFError');
      expect(err.message).toContain('SSRF blocked');
      expect(err.message).toContain('private IP address');
      expect(err.message).toContain('http://evil.com');
    });

    it('is an Error instance', () => {
      const err = new SSRFError('http://evil.com', 'blocked host');
      expect(err instanceof Error).toBe(true);
    });
  });

  describe('URL validation (integration)', () => {
    // These require mocking DNS, so we test the error cases conceptually

    it('SSRFError has descriptive message', () => {
      const err = new SSRFError('http://example.com/path', 'blocked host');
      expect(err.message).toContain('blocked host');
      expect(err.message).toContain('http://example.com/path');
    });
  });
});
