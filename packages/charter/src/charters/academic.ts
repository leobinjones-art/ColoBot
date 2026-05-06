/**
 * 学术写作许可证
 *
 * 解锁论文写作能力，绑定学术规范文档库
 */

import type { CharterDefinition } from '../types.js'

export const ACADEMIC_CHARTER: CharterDefinition = {
  id: 'charter-academic',
  type: 'academic',
  name: 'Academic Writing Charter',
  description: 'Unlock academic paper writing capabilities with citation support',

  capabilities: [
    {
      name: 'paper-writing',
      description: 'Write academic papers with proper citations',
      allowedTools: ['write_file', 'read_file', 'web_search', 'http'],
      maxOutputLength: 100000,
      constraints: {
        requireCitations: true,
        minCitations: 5,
        citationStyle: 'apa', // apa, mla, chicago, etc.
      },
    },
    {
      name: 'literature-review',
      description: 'Conduct literature review and summarize',
      allowedTools: ['web_search', 'http', 'read_file'],
      maxOutputLength: 50000,
      constraints: {
        requireSources: true,
        maxPapers: 50,
      },
    },
    {
      name: 'citation-format',
      description: 'Format citations in academic style',
      allowedTools: ['write_file'],
      constraints: {
        styles: ['apa', 'mla', 'chicago', 'ieee', 'harvard'],
      },
    },
  ],

  libraryId: 'library-academic',

  disclaimer: `This charter enables academic writing capabilities. All citations must be
traceable to verifiable sources. The user is responsible for ensuring accuracy and
avoiding plagiarism. Generated content should be reviewed before submission.`,

  validityMs: 24 * 60 * 60 * 1000, // 24 hours
  requireConfirmation: true,
  createdAt: Date.now(),
}
