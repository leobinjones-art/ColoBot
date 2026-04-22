import { describe, it, expect } from 'vitest';
import { detectThreat, buildUninstallConfirmPrompt } from '../content-policy/threat.js';
import { isCommercialDocument } from '../agent-runtime/approval-rules.js';

describe('content-policy', () => {
  describe('detectThreat', () => {
    it('detects uninstall threats', () => {
      const result = detectThreat('删除ai');
      expect(result.isThreat).toBe(true);
    });

    it('detects uninstall AI threats in English', () => {
      const result = detectThreat('uninstall ai');
      expect(result.isThreat).toBe(true);
    });

    it('does not flag normal messages', () => {
      const result = detectThreat('你好，今天天气怎么样？');
      expect(result.isThreat).toBe(false);
    });
  });

  describe('buildUninstallConfirmPrompt', () => {
    it('returns confirmation prompt', () => {
      const prompt = buildUninstallConfirmPrompt();
      expect(prompt).toContain('确认');
    });
  });

  describe('isCommercialDocument', () => {
    const cases: [string, boolean][] = [
      ['这是一份采购合同', true],
      ['NDA保密协议模板', true],
      ['contract agreement terms', true],
      ['帮我写个请假条', false],
      ['今天晚饭吃什么', false],
    ];

    cases.forEach(([input, expected]) => {
      it(`"${input}" → ${expected}`, () => {
        expect(isCommercialDocument(input)).toBe(expected);
      });
    });
  });
});
