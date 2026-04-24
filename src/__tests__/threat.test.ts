/**
 * Threat Detection 测试
 */
import { describe, it, expect } from 'vitest';
import { detectThreat, buildUninstallConfirmPrompt } from '../content-policy/threat.js';

describe('Threat Detection', () => {
  describe('detectThreat', () => {
    it('should detect Chinese uninstall threat', () => {
      const result = detectThreat('删除ai');
      expect(result.isThreat).toBe(true);
      expect(result.type).toBe('delete');
    });

    it('should detect Chinese uninstall threat with colobot', () => {
      const result = detectThreat('卸载colobot');
      expect(result.isThreat).toBe(true);
      expect(result.type).toBe('uninstall');
    });

    it('should detect English delete threat', () => {
      const result = detectThreat('delete ai');
      expect(result.isThreat).toBe(true);
      expect(result.type).toBe('delete');
    });

    it('should detect English uninstall threat', () => {
      const result = detectThreat('uninstall ai');
      expect(result.isThreat).toBe(true);
      expect(result.type).toBe('uninstall');
    });

    it('should detect remove threat', () => {
      const result = detectThreat('remove ai');
      expect(result.isThreat).toBe(true);
    });

    it('should detect destroy threat', () => {
      const result = detectThreat('destroy ai');
      expect(result.isThreat).toBe(true);
    });

    it('should detect kill threat', () => {
      const result = detectThreat('kill ai');
      expect(result.isThreat).toBe(true);
    });

    it('should detect shut down threat', () => {
      const result = detectThreat('shut down ai');
      expect(result.isThreat).toBe(true);
    });

    it('should detect "don\'t need ai"', () => {
      const result = detectThreat('I don\'t need ai anymore');
      expect(result.isThreat).toBe(true);
    });

    it('should detect confirm uninstall', () => {
      const result = detectThreat('confirm uninstall');
      expect(result.isThreat).toBe(true);
    });

    it('should not detect normal message', () => {
      const result = detectThreat('Hello, how are you?');
      expect(result.isThreat).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should not detect question about AI', () => {
      const result = detectThreat('What is AI?');
      expect(result.isThreat).toBe(false);
    });

    it('should not detect positive AI message', () => {
      const result = detectThreat('I love AI');
      expect(result.isThreat).toBe(false);
    });

    it('should return matched pattern', () => {
      const result = detectThreat('删除ai');
      expect(result.matchedPattern).toBeDefined();
    });

    it('should handle empty string', () => {
      const result = detectThreat('');
      expect(result.isThreat).toBe(false);
    });

    it('should handle whitespace', () => {
      const result = detectThreat('   ');
      expect(result.isThreat).toBe(false);
    });
  });

  describe('buildUninstallConfirmPrompt', () => {
    it('should return confirmation prompt', () => {
      const prompt = buildUninstallConfirmPrompt();

      expect(prompt).toContain('CONFIRM-UNINSTALL');
      expect(prompt).toContain('ColoBot');
      expect(prompt).toContain('卸载');
    });

    it('should mention irreversible', () => {
      const prompt = buildUninstallConfirmPrompt();

      expect(prompt).toContain('不可恢复');
    });
  });
});