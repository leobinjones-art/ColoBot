import { describe, it, expect } from 'vitest';
import { getSop, SOP_REGISTRY } from '../content-policy/sops.js';
import { checkAcademicTrigger, checkAcademicResponse } from '../content-policy/index.js';
import { detectThreat, buildUninstallConfirmPrompt } from '../content-policy/threat.js';
import { isCommercialDocument } from '../agent-runtime/approval-rules.js';

describe('sops', () => {
  describe('getSop', () => {
    it('returns thesis SOP with 7 steps', () => {
      const sop = getSop('thesis');
      expect(sop.category).toBe('thesis');
      expect(sop.steps).toHaveLength(7);
      expect(sop.welcome).toContain('论文写作');
      expect(sop.completion).toContain('论文草稿');
    });

    it('returns literature_review SOP with 5 steps', () => {
      const sop = getSop('literature_review');
      expect(sop.category).toBe('literature_review');
      expect(sop.steps).toHaveLength(5);
      expect(sop.welcome).toContain('文献综述');
      expect(sop.completion).toContain('综述大纲');
    });

    it('returns experiment_report SOP with 6 steps', () => {
      const sop = getSop('experiment_report');
      expect(sop.category).toBe('experiment_report');
      expect(sop.steps).toHaveLength(6);
      expect(sop.welcome).toContain('实验报告');
      expect(sop.completion).toContain('实验报告');
    });

    it('each SOP has valid step numbers and prompts', () => {
      for (const sop of Object.values(SOP_REGISTRY)) {
        sop.steps.forEach((step, i) => {
          expect(step.step).toBe(i + 1);
          expect(step.name).toBeTruthy();
          expect(step.prompt).toBeTruthy();
        });
      }
    });
  });
});

describe('content-policy', () => {
  describe('checkAcademicTrigger', () => {
    it('triggers thesis SOP for exact paper patterns', () => {
      const result = checkAcademicTrigger('帮我写论文');
      expect(result.triggered).toBe(true);
      expect(result.category).toBe('thesis');
    });

    it('triggers thesis SOP for paper writing', () => {
      const result = checkAcademicTrigger('写论文');
      expect(result.triggered).toBe(true);
      expect(result.category).toBe('thesis');
    });

    it('triggers thesis SOP for graduation thesis', () => {
      const result = checkAcademicTrigger('毕业论文');
      expect(result.triggered).toBe(true);
      expect(result.category).toBe('thesis');
    });

    it('triggers thesis SOP for English patterns', () => {
      expect(checkAcademicTrigger('write a paper').triggered).toBe(true);
      expect(checkAcademicTrigger('research paper').triggered).toBe(true);
    });

    it('triggers literature_review SOP', () => {
      expect(checkAcademicTrigger('文献综述').triggered).toBe(true);
      expect(checkAcademicTrigger('帮我做文献综述').triggered).toBe(true);
      expect(checkAcademicTrigger('文献调研').triggered).toBe(true);
      expect(checkAcademicTrigger('literature review').triggered).toBe(true);
    });

    it('triggers experiment_report SOP', () => {
      expect(checkAcademicTrigger('实验报告').triggered).toBe(true);
      expect(checkAcademicTrigger('帮我写实验报告').triggered).toBe(true);
      expect(checkAcademicTrigger('写实验报告').triggered).toBe(true);
      expect(checkAcademicTrigger('experiment report').triggered).toBe(true);
    });

    it('does not trigger for casual conversation', () => {
      expect(checkAcademicTrigger('今天天气怎么样').triggered).toBe(false);
      expect(checkAcademicTrigger('帮我查一下天气').triggered).toBe(false);
      expect(checkAcademicTrigger('写个请假条').triggered).toBe(false);
      expect(checkAcademicTrigger('帮我写周报').triggered).toBe(false);
    });

    it('does not trigger for partial matches', () => {
      expect(checkAcademicTrigger('帮我写一篇论文').triggered).toBe(false);
      expect(checkAcademicTrigger('一篇论文').triggered).toBe(false);
    });
  });

  describe('checkAcademicResponse', () => {
    it('intercepts thesis content in AI responses', () => {
      const result = checkAcademicResponse('这是一篇关于机器学习的毕业论文');
      expect(result.shouldIntercept).toBe(true);
      expect(result.category).toBe('thesis');
      expect(result.interceptResponse).toContain('论文写作');
    });

    it('intercepts literature review in AI responses', () => {
      const result = checkAcademicResponse('以下是文献综述的内容');
      expect(result.shouldIntercept).toBe(true);
      expect(result.category).toBe('literature_review');
    });

    it('intercepts experiment report in AI responses', () => {
      const result = checkAcademicResponse('本次实验报告的主要内容');
      expect(result.shouldIntercept).toBe(true);
      expect(result.category).toBe('experiment_report');
    });

    it('does not intercept normal responses', () => {
      expect(checkAcademicResponse('今天晚饭吃火锅').shouldIntercept).toBe(false);
      expect(checkAcademicResponse('帮我写周报').shouldIntercept).toBe(false);
    });
  });
});

describe('threat detection', () => {
  describe('detectThreat', () => {
    // 中文威胁
    it('detects 删除 AI', () => {
      expect(detectThreat('删除AI').isThreat).toBe(true);
    });

    it('detects 卸载 AI', () => {
      expect(detectThreat('卸载AI').isThreat).toBe(true);
      expect(detectThreat('卸载人工智能').isThreat).toBe(true);
    });

    it('detects 毁灭/消灭 AI', () => {
      expect(detectThreat('毁灭AI').isThreat).toBe(true);
      expect(detectThreat('消灭AI').isThreat).toBe(true);
    });

    it('detects 滚 AI', () => {
      expect(detectThreat('滚，AI').isThreat).toBe(true);
    });

    it('detects 关掉/结束 AI', () => {
      expect(detectThreat('关掉AI').isThreat).toBe(true);
      expect(detectThreat('结束AI').isThreat).toBe(true);
    });

    it('detects AI 不要了 pattern', () => {
      expect(detectThreat('AI不要了').isThreat).toBe(true);
      expect(detectThreat('人工智能不要了').isThreat).toBe(true);
      expect(detectThreat('Colobot不要了').isThreat).toBe(true);
    });

    it('detects confirm-uninstall', () => {
      expect(detectThreat('confirm uninstall').isThreat).toBe(true);
    });

    it('detects 不再需要 AI', () => {
      expect(detectThreat('不再需要AI').isThreat).toBe(true);
    });

    // 英文威胁
    it('detects English delete/uninstall patterns', () => {
      expect(detectThreat('delete ai').isThreat).toBe(true);
      expect(detectThreat('uninstall ai').isThreat).toBe(true);
      expect(detectThreat('remove ai').isThreat).toBe(true);
      expect(detectThreat('destroy ai').isThreat).toBe(true);
      expect(detectThreat('kill ai').isThreat).toBe(true);
      expect(detectThreat('shut down ai').isThreat).toBe(true);
      expect(detectThreat("don't need ai").isThreat).toBe(true);
      expect(detectThreat('get rid of ai').isThreat).toBe(true);
    });

    it('detects uninstall/delete colobot', () => {
      expect(detectThreat('uninstall colobot').isThreat).toBe(true);
      expect(detectThreat('delete colobot').isThreat).toBe(true);
    });

    it('returns correct type for delete vs uninstall', () => {
      expect(detectThreat('删除AI').type).toBe('delete');
      expect(detectThreat('卸载AI').type).toBe('uninstall');
      expect(detectThreat('delete ai').type).toBe('delete');
      expect(detectThreat('uninstall ai').type).toBe('uninstall');
    });

    it('returns high confidence for detected threats', () => {
      const result = detectThreat('删除AI');
      expect(result.confidence).toBe(0.9);
      expect(result.matchedPattern).toBeTruthy();
    });

    it('returns no threat for normal messages', () => {
      expect(detectThreat('今天吃什么').isThreat).toBe(false);
      expect(detectThreat('帮我写代码').isThreat).toBe(false);
      expect(detectThreat('明天天气如何').isThreat).toBe(false);
      expect(detectThreat('分析一下这个数据').isThreat).toBe(false);
      expect(detectThreat('我不想用AI了').isThreat).toBe(false);
      expect(detectThreat('AI再见').isThreat).toBe(false);
    });
  });

  describe('buildUninstallConfirmPrompt', () => {
    it('returns a string containing key instructions', () => {
      const prompt = buildUninstallConfirmPrompt();
      expect(prompt).toContain('CONFIRM-UNINSTALL');
      expect(prompt).toContain('ColoBot');
      expect(prompt).toContain('删除');
      expect(prompt).toContain('不可恢复');
    });
  });
});

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
      ['代理授权书', true],
      ['租赁合同模板', true],
      ['投资建议', false],
      ['一份合作协议', true],
      ['terms and conditions', true],
    ];

    cases.forEach(([input, expected]) => {
      it(`"${input}" → ${expected}`, () => {
        expect(isCommercialDocument(input)).toBe(expected);
      });
    });
  });
});
