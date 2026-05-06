/**
 * 长文档许可证
 *
 * 解锁长文档处理能力，支持分区处理
 */

import type { CharterDefinition } from '../types.js'

export const LONGDOC_CHARTER: CharterDefinition = {
  id: 'charter-longdoc',
  type: 'longdoc',
  name: 'Long Document Charter',
  description: 'Unlock long document processing with partition support',

  capabilities: [
    {
      name: 'long-document-write',
      description: 'Write long documents with partition strategy',
      allowedTools: ['write_file', 'read_file'],
      maxOutputLength: 500000, // 500KB
      constraints: {
        partitionSize: 10000, // 10KB per partition
        parallelPartitions: 3,
      },
    },
    {
      name: 'document-merge',
      description: 'Merge multiple document parts',
      allowedTools: ['write_file', 'read_file'],
      constraints: {
        maxParts: 50,
      },
    },
    {
      name: 'toc-generate',
      description: 'Generate table of contents',
      allowedTools: ['write_file', 'read_file'],
    },
  ],

  libraryId: 'library-general',

  disclaimer: `This charter enables long document processing. Large outputs may be
partitioned for processing. Ensure sufficient storage and memory before proceeding.`,

  validityMs: 6 * 60 * 60 * 1000, // 6 hours
  requireConfirmation: false, // Auto-approve for long docs
  createdAt: Date.now(),
}
