import { describe, it, expect } from 'vitest';
import { isCommercialDocument } from '../agent-runtime/approval-rules.js';

describe('approval-rules', () => {
  describe('isCommercialDocument', () => {
    const cases: [string, boolean][] = [
      ['这是一份采购合同', true],
      ['NDA保密协议模板', true],
      ['contract agreement terms', true],
      ['Letter of Intent', true],
      ['MoU between two parties', true],
      ['帮我写个请假条', false],
      ['今天晚饭吃什么', false],
      ['帮我分析一下这个代码', false],
      ['合同编号是12345', true],
      ['请帮我起草一份保密协议', true],
    ];

    cases.forEach(([input, expected]) => {
      it(`"${input}" → ${expected}`, () => {
        expect(isCommercialDocument(input)).toBe(expected);
      });
    });
  });
});
