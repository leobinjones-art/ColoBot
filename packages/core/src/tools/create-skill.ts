/**
 * 创建 Skill 工具 - Agent 主动创建新 Skill
 */

import type { ToolContext } from '@colobot/types';
import { toolRegistry } from './registry.js';
import { writePendingSkill, approveSkill } from '../skill-evolution/index.js';
import { getAgentTrustStatus } from '../content/poison-defense.js';

async function createSkill(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const { name, description, trigger_words, markdown_content, auto_approve } = args as {
    name: string;
    description?: string;
    trigger_words: string[];
    markdown_content: string;
    auto_approve?: boolean;
  };

  if (!name || !markdown_content) {
    throw new Error('name and markdown_content are required');
  }

  // 检查信任等级
  const trustStatus = await getAgentTrustStatus(ctx.agentId);
  const canAutoApprove = trustStatus?.status === 'trusted' || auto_approve === false;

  const fullMarkdown = `# ${name}

${description ? `## 描述\n${description}\n` : ''}
## 触发词
${(trigger_words || [name.toLowerCase()]).map(w => `- ${w}`).join('\n')}

${markdown_content}
`;

  if (canAutoApprove && auto_approve !== false) {
    // 高信任：直接激活
    await approveSkill(name, ctx.agentId);
    return `Skill "${name}" created and activated successfully.`;
  } else {
    // 中/低信任：待审批
    await writePendingSkill(ctx.agentId, name, fullMarkdown, []);
    return `Skill "${name}" created and pending approval.`;
  }
}

export function registerCreateSkillTool(): void {
  toolRegistry.register({
    name: 'create_skill',
    description: 'Create a new skill that can be triggered in future conversations',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill name' },
        description: { type: 'string', description: 'Skill description' },
        trigger_words: { type: 'array', items: { type: 'string' }, description: 'Words that trigger this skill' },
        markdown_content: { type: 'string', description: 'Skill markdown content with instructions' },
        auto_approve: { type: 'boolean', description: 'Whether to auto-approve (requires high trust)' },
      },
      required: ['name', 'markdown_content'],
    },
    execute: createSkill,
  });
}

export { createSkill };
