/**
 * 内容策略规则 - 硬编码学术相关检测模式
 */

export type AcademicCategory = 'thesis' | 'literature_review' | 'experiment_report';

export interface ContentRule {
  pattern: RegExp;
  category: AcademicCategory;
  label: string;
}

const ACADEMIC_PATTERNS: ContentRule[] = [
  // 论文
  {
    pattern: /写论文|帮我写论文|论文代写|生成论文|论文写作|毕业论文|学术论文/i,
    category: 'thesis',
    label: '论文写作',
  },
  {
    pattern: /写篇论文|写一份论文|写一个论文/i,
    category: 'thesis',
    label: '论文写作',
  },
  {
    pattern: /research\s*paper|write\s*a\s*paper|paper\s*writing|thesis\s*writing/i,
    category: 'thesis',
    label: '论文写作',
  },
  // 文献综述
  {
    pattern: /文献综述|综述写作|文献调研|写文献综述/i,
    category: 'literature_review',
    label: '文献综述',
  },
  {
    pattern: /literature\s*review|systematic\s*review|meta.?analysis/i,
    category: 'literature_review',
    label: '文献综述',
  },
  // 实验报告
  {
    pattern: /实验报告|实验记录|实验总结|写实验报告/i,
    category: 'experiment_report',
    label: '实验报告',
  },
  {
    pattern: /experiment\s*report|lab\s*report|research\s*report/i,
    category: 'experiment_report',
    label: '实验报告',
  },
];

export function matchAcademicCategory(text: string): AcademicCategory | null {
  for (const rule of ACADEMIC_PATTERNS) {
    if (rule.pattern.test(text)) {
      return rule.category;
    }
  }
  return null;
}

export function getRuleLabel(category: AcademicCategory): string {
  const rule = ACADEMIC_PATTERNS.find(r => r.category === category);
  return rule?.label ?? '学术内容';
}
