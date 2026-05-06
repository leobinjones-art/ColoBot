/**
 * 学术文档库
 *
 * 提供引用规范、学术标准等事实来源
 */

import type { DocumentLibrary } from '../types.js'

export const ACADEMIC_LIBRARY: DocumentLibrary = {
  id: 'library-academic',
  name: 'Academic Standards Library',
  description: 'Citation standards and academic writing guidelines',

  entries: [
    {
      id: 'citation-apa',
      type: 'citation',
      title: 'APA Citation Style',
      content: `
# APA Citation Style (7th Edition)

## In-text Citations
- Author, Year: (Smith, 2020) or Smith (2020)
- Multiple authors: (Smith & Jones, 2020) or (Smith et al., 2020)

## Reference List Format
- Journal: Author, A. A. (Year). Title. Journal Name, Volume(Issue), Pages.
- Book: Author, A. A. (Year). Title. Publisher.
- Website: Author, A. A. (Year). Title. Site Name. URL

## Key Rules
1. Alphabetical order by author surname
2. Double-space all entries
3. Hanging indent format
4. DOI preferred when available
`,
      source: 'https://apastyle.apa.org/',
      tags: ['citation', 'apa', 'academic'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'citation-mla',
      type: 'citation',
      title: 'MLA Citation Style',
      content: `
# MLA Citation Style (9th Edition)

## In-text Citations
- Author + Page: (Smith 123) or Smith argues (123)

## Works Cited Format
- Book: Smith, John. Title. Publisher, Year.
- Journal: Smith, John. "Article Title." Journal Name, vol. X, no. Y, Year, pp. XX-YY.
- Website: Smith, John. "Page Title." Website Name, Day Month Year, URL.

## Key Rules
1. Author's full name (Last, First)
2. Title in quotation marks for articles
3. Container title italicized
`,
      source: 'https://style.mla.org/',
      tags: ['citation', 'mla', 'academic'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'citation-ieee',
      type: 'citation',
      title: 'IEEE Citation Style',
      content: `
# IEEE Citation Style

## In-text Citations
- Numbered: [1] or [1-3] or [1, 3, 5]

## Reference List Format
- Journal: [1] A. Author, "Title," Journal Name, vol. X, no. Y, pp. XX-YY, Year.
- Conference: [2] A. Author, "Title," in Proc. Conference Name, Year, pp. XX-YY.
- Book: [3] A. Author, Title. City: Publisher, Year.

## Key Rules
1. Numbered references in order of appearance
2. Square brackets for citation numbers
3. Author initials (A. B. Author)
`,
      source: 'https://ieeeauthorcenter.ieee.org/',
      tags: ['citation', 'ieee', 'technical'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'academic-ethics',
      type: 'regulation',
      title: 'Academic Ethics Guidelines',
      content: `
# Academic Ethics Guidelines

## Core Principles
1. Honesty: Report data accurately, do not fabricate
2. Objectivity: Avoid bias in research design and reporting
3. Integrity: Keep promises, act consistently
4. Carefulness: Avoid errors, double-check data
5. Openness: Share data, methods, ideas
6. Respect: Honor intellectual property, cite sources
7. Confidentiality: Protect sensitive information

## Plagiarism Prevention
- Always cite sources
- Use quotation marks for direct quotes
- Paraphrase with attribution
- Self-plagiarism requires disclosure

## Data Management
- Document all data collection methods
- Store raw data securely
- Make data available for verification
`,
      tags: ['ethics', 'plagiarism', 'guidelines'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
}