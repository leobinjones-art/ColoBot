/**
 * Logger 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LogLevel, createLogger, logger } from '../utils/logger.js';

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('LogLevel', () => {
    it('should have correct order', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
    });
  });

  describe('Logger', () => {
    it('should log debug when level is DEBUG', () => {
      const log = new Logger({ level: LogLevel.DEBUG });
      log.debug('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not log debug when level is INFO', () => {
      const log = new Logger({ level: LogLevel.INFO });
      log.debug('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log info when level is INFO', () => {
      const log = new Logger({ level: LogLevel.INFO });
      log.info('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log warn when level is WARN', () => {
      const log = new Logger({ level: LogLevel.WARN });
      log.warn('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not log info when level is WARN', () => {
      const log = new Logger({ level: LogLevel.WARN });
      log.info('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log error when level is ERROR', () => {
      const log = new Logger({ level: LogLevel.ERROR });
      log.error('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not log warn when level is ERROR', () => {
      const log = new Logger({ level: LogLevel.ERROR });
      log.warn('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should include prefix', () => {
      const log = new Logger({ prefix: '[Test]', level: LogLevel.DEBUG });
      log.info('message');
      expect(consoleSpy.mock.calls[0][0]).toContain('[Test]');
    });

    it('should include timestamp when enabled', () => {
      const log = new Logger({ timestamp: true, level: LogLevel.DEBUG });
      log.info('message');
      expect(consoleSpy.mock.calls[0][0]).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('should not include timestamp when disabled', () => {
      const log = new Logger({ timestamp: false, level: LogLevel.DEBUG });
      log.info('message');
      expect(consoleSpy.mock.calls[0][0]).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('should handle additional args', () => {
      const log = new Logger({ level: LogLevel.DEBUG });
      log.info('message', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should allow changing level', () => {
      const log = new Logger({ level: LogLevel.INFO });
      log.debug('should not log');
      expect(consoleSpy).not.toHaveBeenCalled();

      log.setLevel(LogLevel.DEBUG);
      log.debug('should log now');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should allow changing prefix', () => {
      const log = new Logger({ prefix: 'Old', level: LogLevel.DEBUG });
      log.setPrefix('New');
      log.info('message');
      expect(consoleSpy.mock.calls[0][0]).toContain('New');
    });
  });

  describe('createLogger', () => {
    it('should create new logger instance', () => {
      const log = createLogger({ prefix: '[Custom]' });
      expect(log).toBeInstanceOf(Logger);
    });
  });

  describe('default logger', () => {
    it('should be a Logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });
  });
});
