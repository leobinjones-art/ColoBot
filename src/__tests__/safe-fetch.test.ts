import { describe, it, expect } from 'vitest';
import { SSRFError, validateURL } from '../utils/safe-fetch.js';

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

  describe('validateURL', () => {
    it('rejects invalid URL format', async () => {
      await expect(validateURL('not-a-url')).rejects.toThrow(SSRFError);
      await expect(validateURL('://missing-protocol')).rejects.toThrow(SSRFError);
    });

    it('rejects non-HTTP protocols', async () => {
      await expect(validateURL('ftp://example.com')).rejects.toThrow(SSRFError);
      await expect(validateURL('file:///etc/passwd')).rejects.toThrow(SSRFError);
      await expect(validateURL('mailto://user@example.com')).rejects.toThrow(SSRFError);
      await expect(validateURL('ssh://server/path')).rejects.toThrow(SSRFError);
    });

    it('rejects blocked hosts', async () => {
      await expect(validateURL('http://localhost/path')).rejects.toThrow(SSRFError);
      await expect(validateURL('http://localhost.localdomain/file')).rejects.toThrow(SSRFError);
      await expect(validateURL('http://ip6-localhost/api')).rejects.toThrow(SSRFError);
      await expect(validateURL('http://ip6-loopback.eu/path')).rejects.toThrow(SSRFError);
    });

    it('rejects metadata endpoints', async () => {
      await expect(validateURL('http://169.254.169.254/latest/meta-data')).rejects.toThrow(SSRFError);
      await expect(validateURL('http://169.254.169.249/api')).rejects.toThrow(SSRFError);
      await expect(validateURL('http://169.254.169.240/')).rejects.toThrow(SSRFError);
    });

    it('rejects direct private IPv4 addresses', async () => {
      await expect(validateURL('http://127.0.0.1:8080/api')).rejects.toThrow(SSRFError);
      await expect(validateURL('http://10.0.0.1/admin')).rejects.toThrow(SSRFError);
      await expect(validateURL('http://192.168.1.1/router')).rejects.toThrow(SSRFError);
      await expect(validateURL('http://172.16.0.1/path')).rejects.toThrow(SSRFError);
      await expect(validateURL('http://172.31.255.255/api')).rejects.toThrow(SSRFError);
    });

    it('accepts valid public URL', async () => {
      const url = await validateURL('https://example.com/api?key=val');
      expect(url.hostname).toBe('example.com');
      expect(url.protocol).toBe('https:');
    });

    it('accepts URL with port', async () => {
      const url = await validateURL('http://example.com:8080/api');
      expect(url.host).toBe('example.com:8080');
    });

    it('SSRFError message includes URL and reason', () => {
      const err = new SSRFError('http://example.com/path', 'blocked host');
      expect(err.message).toContain('example.com/path');
      expect(err.message).toContain('blocked host');
    });
  });
});
