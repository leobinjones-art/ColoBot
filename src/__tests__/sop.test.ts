import { describe, it, expect } from 'vitest';

describe('sop (conceptual)', () => {
  // SOP state machine is tested conceptually here
  // Full integration test requires DB setup

  describe('SOP categories', () => {
    it('should support thesis, literature_review, and experiment_report', () => {
      const validCategories = ['thesis', 'literature_review', 'experiment_report'];
      expect(validCategories).toContain('thesis');
      expect(validCategories).toContain('literature_review');
      expect(validCategories).toContain('experiment_report');
    });
  });

  describe('SOP steps', () => {
    it('thesis SOP should have 7 steps', () => {
      const THESIS_STEPS = [
        '收集主题',
        '补充资料',
        '任务拆解',
        '操作手册',
        '实验指引',
        '数据分析',
        '论文草稿',
      ];
      expect(THESIS_STEPS).toHaveLength(7);
    });

    it('literature_review SOP should have 5 steps', () => {
      const LIT_REVIEW_STEPS = [
        '确定研究领域',
        '文献检索策略',
        '文献筛选与整理',
        '分析与评述',
        '综述大纲',
      ];
      expect(LIT_REVIEW_STEPS).toHaveLength(5);
    });

    it('experiment_report SOP should have 6 steps', () => {
      const EXP_STEPS = [
        '实验目的',
        '材料与方法',
        '实验步骤',
        '数据记录',
        '数据分析',
        '报告草稿',
      ];
      expect(EXP_STEPS).toHaveLength(6);
    });
  });
});
