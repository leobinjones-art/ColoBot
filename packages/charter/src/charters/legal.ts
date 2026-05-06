/**
 * 法律文书许可证
 *
 * 解锁法律文书生成能力，绑定法律条款文档库
 */

import type { CharterDefinition } from '../types.js'

export const LEGAL_CHARTER: CharterDefinition = {
  id: 'charter-legal',
  type: 'legal',
  name: 'Legal Document Charter',
  description: 'Unlock legal document generation with disclaimer templates',

  capabilities: [
    {
      name: 'contract-draft',
      description: 'Draft contract documents',
      allowedTools: ['write_file', 'read_file'],
      maxOutputLength: 50000,
      constraints: {
        requireReview: true,
        jurisdiction: 'cn', // cn, us, eu, etc.
      },
    },
    {
      name: 'disclaimer-generate',
      description: 'Generate disclaimer and liability clauses',
      allowedTools: ['write_file'],
      constraints: {
        types: ['privacy', 'liability', 'terms', 'nda'],
      },
    },
    {
      name: 'legal-analysis',
      description: 'Analyze legal documents and provide insights',
      allowedTools: ['read_file', 'web_search'],
      maxOutputLength: 20000,
      constraints: {
        disclaimer: 'Not legal advice. Consult a licensed attorney.',
      },
    },
  ],

  libraryId: 'library-legal',

  disclaimer: `This charter enables legal document generation for reference purposes only.
Generated documents are NOT legal advice and should be reviewed by a licensed attorney
before use. The user assumes all responsibility for the use of generated content.`,

  validityMs: 12 * 60 * 60 * 1000, // 12 hours
  requireConfirmation: true,
  createdAt: Date.now(),
}
