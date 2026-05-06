/**
 * 通用文档库
 *
 * 提供通用写作规范
 */

import type { DocumentLibrary } from '../types.js'

export const GENERAL_LIBRARY: DocumentLibrary = {
  id: 'library-general',
  name: 'General Writing Library',
  description: 'General writing standards and document formatting guidelines',

  entries: [
    {
      id: 'document-structure',
      type: 'template',
      title: 'Document Structure Guidelines',
      content: `
# Document Structure Guidelines

## Standard Document Structure
1. **Title**: Clear, descriptive, concise
2. **Abstract/Summary**: 150-300 words overview
3. **Introduction**: Context, objectives, scope
4. **Body**: Organized by sections/headings
5. **Conclusion**: Summary, implications, recommendations
6. **References**: All cited sources
7. **Appendices**: Supplementary material

## Heading Levels
- Level 1: Main sections (Chapter, Part)
- Level 2: Subsections
- Level 3: Sub-subsections
- Level 4: Detailed breakdowns

## Paragraph Guidelines
- 3-5 sentences per paragraph
- Clear topic sentence
- Supporting evidence
- Transition to next paragraph

## Formatting Standards
- Font: 12pt standard (Times, Arial)
- Line spacing: 1.5 or double
- Margins: 1 inch (2.5 cm)
- Page numbers: Bottom center or top right
`,
      tags: ['structure', 'formatting', 'guidelines'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'writing-style',
      type: 'regulation',
      title: 'Writing Style Guidelines',
      content: `
# Writing Style Guidelines

## Clarity
- Use simple, direct language
- Avoid jargon unless necessary
- Define technical terms
- Use active voice when possible

## Conciseness
- Remove unnecessary words
- Avoid redundancy
- Use precise vocabulary
- One idea per sentence

## Consistency
- Maintain consistent terminology
- Use same style throughout
- Follow chosen citation style
- Consistent formatting

## Tone
- Professional and objective
- Avoid emotional language
- Acknowledge limitations
- Respect diverse perspectives

## Grammar Rules
- Subject-verb agreement
- Proper punctuation
- Complete sentences
- Correct spelling
`,
      tags: ['style', 'writing', 'guidelines'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'toc-template',
      type: 'template',
      title: 'Table of Contents Template',
      content: `
# Table of Contents Template

## Format
Table of Contents should include:
- All major sections and subsections
- Page numbers aligned right
- Dotted leaders between title and number
- Indentation for subsection levels

## Example
\`\`\`
Table of Contents

1. Introduction.............................1
   1.1 Background.........................2
   1.2 Objectives..........................3
2. Methodology..............................4
   2.1 Research Design....................5
   2.2 Data Collection....................6
3. Results..................................7
4. Discussion...............................8
5. Conclusion...............................9
References..................................10
Appendices.................................11
\`\`\`

## Best Practices
- Update after final editing
- Check page number accuracy
- Include all referenced sections
- Maintain consistent formatting
`,
      tags: ['toc', 'template', 'formatting'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
}