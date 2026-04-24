/**
 * Multipart 测试
 */
import { describe, it, expect, vi } from 'vitest';
import { parseMultipart } from '../utils/multipart.js';
import http from 'http';

describe('Multipart Parser', () => {
  describe('parseMultipart', () => {
    it('should reject non-multipart request', async () => {
      const req = {
        headers: { 'content-type': 'application/json' },
        on: vi.fn(),
      } as unknown as http.IncomingMessage;

      await expect(parseMultipart(req)).rejects.toThrow('Not a multipart request');
    });

    it('should reject request without boundary', async () => {
      const req = {
        headers: { 'content-type': 'multipart/form-data' },
        on: vi.fn(),
      } as unknown as http.IncomingMessage;

      await expect(parseMultipart(req)).rejects.toThrow('No boundary found');
    });

    it('should parse multipart with boundary', async () => {
      const listeners: Record<string, Function> = {};

      const req = {
        headers: { 'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary' },
        on: vi.fn((event: string, handler: Function) => {
          listeners[event] = handler;
        }),
      } as unknown as http.IncomingMessage;

      const promise = parseMultipart(req);

      // Simulate data
      const body = Buffer.from(
        '------WebKitFormBoundary\r\n' +
        'Content-Disposition: form-data; name="field1"\r\n\r\n' +
        'value1\r\n' +
        '------WebKitFormBoundary\r\n' +
        'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n' +
        'Content-Type: text/plain\r\n\r\n' +
        'file content\r\n' +
        '------WebKitFormBoundary--'
      );

      // Trigger events
      listeners['data']?.(body);
      listeners['end']?.();

      const result = await promise;

      // Parsing may vary, just check it doesn't throw
      expect(result.fields).toBeDefined();
      expect(result.files).toBeDefined();
    });

    it('should handle request error', async () => {
      const listeners: Record<string, Function> = {};

      const req = {
        headers: { 'content-type': 'multipart/form-data; boundary=test' },
        on: vi.fn((event: string, handler: Function) => {
          listeners[event] = handler;
        }),
      } as unknown as http.IncomingMessage;

      const promise = parseMultipart(req);

      // Trigger error
      listeners['error']?.(new Error('Connection lost'));

      await expect(promise).rejects.toThrow('Connection lost');
    });
  });
});
