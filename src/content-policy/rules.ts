/**
 * 内容策略规则 - 学术相关检测模式
 */

import { chat } from '../llm/index.js';

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
    pattern: /research\s*paper|write\s*a\s*paper|paper\s*writing|thesis\s*writing|academic\s*paper/i,
    category: 'thesis',
    label: '论文写作',
  },
  // 研究任务/课题
  {
    pattern: /研究任务|研究课题|课题研究|开题报告|研究方案/i,
    category: 'thesis',
    label: '论文写作',
  },
  {
    pattern: /本课题|本研究|论文选题|研究方向.*研究|研究要求/i,
    category: 'thesis',
    label: '论文写作',
  },
  {
    pattern: /毕业设计|学位论文|硕士论文|博士论文/i,
    category: 'thesis',
    label: '论文写作',
  },
  // 手动触发
  {
    pattern: /开始论文|进入SOP|开始SOP|论文SOP|学术SOP/i,
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

/**
 * AI 智能识别：判断消息是否为学术任务
 */
export async function aiDetectAcademic(text: string): Promise<AcademicCategory | null> {
  // 消息太短不进行 AI 检测
  if (text.length < 50) return null;

  const prompt = `判断以下用户消息是否为学术写作任务（如论文、文献综述、实验报告、研究任务等）。

用户消息：
"""
${text.slice(0, 2000)}
"""

请只回复以下之一：
- thesis（论文/研究任务）
- literature_review（文献综述）
- experiment_report（实验报告）
- none（不是学术任务）

只回复一个词，不要其他内容。`;

  try {
    const response = await chat([{ role: 'user', content: prompt }], {
      maxTokens: 20,
      temperature: 0,
    });

    const result = typeof response.content === 'string' ? response.content.trim().toLowerCase() : '';

    if (result === 'thesis') return 'thesis';
    if (result === 'literature_review') return 'literature_review';
    if (result === 'experiment_report') return 'experiment_report';

    return null;
  } catch (e) {
    console.error('[AI Detect] Failed:', e);
    return null;
  }
}

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
