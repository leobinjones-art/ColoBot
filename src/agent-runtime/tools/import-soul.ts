/**
 * OpenClaw SOUL.md 导入工具 - Agent 可直接调用
 *
 * 参数：
 *   markdown: SOUL.md 内容（与 url 二选一）
 *   url: SOUL.md 远程地址（与 markdown 二选一）
 *   name: Agent 名称（可选，用于无标题时兜底）
 *   create: 是否直接创建 Agent（默认 false，仅解析）
 */
import { registerTool } from './executor.js';
import { parseOpenClawSoul, toColoBotSoul } from './openclaw.js';

function register() {
  registerTool('import_soul', async (args) => {
    const { markdown, url, name, create } = args as {
      markdown?: string;
      url?: string;
      name?: string;
      create?: boolean;
    };

    if (!markdown && !url) {
      throw new Error('Either markdown or url is required');
    }

    let content = markdown;

    if (!content && url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      content = await res.text();
    }

    if (!content) throw new Error('No content provided');

    const parsed = parseOpenClawSoul(content, name);
    const soulContent = toColoBotSoul(parsed);

    if (create) {
      const { agentRegistry } = await import('../../agents/registry.js');
      const agentName = name || parsed.role || 'imported-agent';
      const agent = await agentRegistry.create({
        name: agentName,
        soul_content: soulContent,
      });
      return { ok: true, agentId: agent.id, agentName: agent.name, role: parsed.role, personality: parsed.personality, rulesCount: parsed.rules.length, skillsCount: parsed.skills.length };
    }

    return { ok: true, role: parsed.role, personality: parsed.personality, rulesCount: parsed.rules.length, skills: parsed.skills };
  });
}

export function registerTools(): void {
  register();
}
