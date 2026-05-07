/**
 * 法律文档库
 *
 * 提供法律条款、免责模板等事实来源
 */

import type { DocumentLibrary } from '../types.js'

export const LEGAL_LIBRARY: DocumentLibrary = {
  id: 'library-legal',
  name: 'Legal Document Library',
  description: 'Legal clauses, disclaimer templates, and regulatory references',

  entries: [
    {
      id: 'disclaimer-liability',
      type: 'template',
      title: 'Liability Disclaimer Template',
      content: `
# Liability Disclaimer

## General Disclaimer
The information provided by [SERVICE] is for general informational purposes only.
All information on the site is provided in good faith, however we make no
representation or warranty of any kind, express or implied, regarding the
accuracy, adequacy, validity, reliability, availability, or completeness of
any information on the site.

## No Professional Advice
The site cannot and does not contain legal advice. The information is provided
for general informational and educational purposes only and is not a substitute
for professional legal advice.

## Limitation of Liability
UNDER NO CIRCUMSTANCE SHALL WE HAVE ANY LIABILITY TO YOU FOR ANY LOSS OR DAMAGE
OF ANY KIND INCURRED AS A RESULT OF THE USE OF THE SITE OR RELIANCE ON ANY
INFORMATION PROVIDED ON THE SITE.

## Applicable Law
This disclaimer shall be governed by and construed in accordance with applicable
laws, without regard to its conflict of law provisions.
`,
      tags: ['disclaimer', 'liability', 'template'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'disclaimer-privacy',
      type: 'template',
      title: 'Privacy Notice Template',
      content: `
# Privacy Notice

## Information We Collect
We collect information you provide directly to us, including:
- Account information (name, email, password)
- Content you create or upload
- Communications you send to us

## How We Use Information
We use the information we collect to:
- Provide, maintain, and improve our services
- Process transactions and send related information
- Send technical notices and support messages
- Respond to your comments and questions

## Information Sharing
We do not sell your personal information. We may share information with:
- Service providers who assist in our operations
- Professional advisors (lawyers, accountants)
- Law enforcement when required by law

## Data Retention
We retain your information for as long as your account is active or as needed
to provide you services.
`,
      tags: ['privacy', 'gdpr', 'template'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'nda-template',
      type: 'template',
      title: 'Non-Disclosure Agreement Template',
      content: `
# Non-Disclosure Agreement

This Non-Disclosure Agreement ("Agreement") is entered into as of [DATE] by and
between [PARTY A] and [PARTY B].

## Definition of Confidential Information
"Confidential Information" means any information disclosed by either party,
including but not limited to:
- Technical data, trade secrets, know-how
- Business plans, strategies, financial information
- Customer lists, supplier information
- Software, code, algorithms

## Obligations
Each party agrees to:
1. Keep Confidential Information strictly confidential
2. Use Confidential Information only for the stated purpose
3. Not disclose Confidential Information to third parties
4. Return or destroy Confidential Information upon request

## Exclusions
This Agreement does not apply to information that:
- Is or becomes publicly available
- Was already known to the receiving party
- Is independently developed
- Is required to be disclosed by law

## Term
This Agreement shall remain in effect for [X] years from the date of signing.
`,
      tags: ['nda', 'confidentiality', 'template'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'contract-terms',
      type: 'regulation',
      title: 'Standard Contract Terms',
      content: `
# Standard Contract Terms

## Essential Contract Elements
1. **Offer and Acceptance**: Clear terms agreed by all parties
2. **Consideration**: Something of value exchanged
3. **Capacity**: Legal ability to enter contract
4. **Legality**: Contract purpose must be legal

## Common Clauses
- **Termination**: Conditions for ending the agreement
- **Force Majeure**: Excuse for unforeseeable events
- **Indemnification**: Compensation for losses
- **Governing Law**: Jurisdiction for disputes
- **Severability**: Invalid clauses don't void entire contract

## Best Practices
1. Use clear, unambiguous language
2. Define key terms
3. Include dispute resolution mechanism
4. Specify payment terms
5. Include confidentiality provisions when needed
`,
      tags: ['contract', 'terms', 'guidelines'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
}
