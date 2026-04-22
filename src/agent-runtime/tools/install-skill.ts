/**
 * 安装 Skill 工具 - Agent 可从 ClawHub 安装 Skill
 */

import { registerTool } from './executor.js';
import { importFromClawHub, importFromClawHubUrl, parseClawHubSkill, toColoBotSkill } from './clawhub-compat.js';
import { query } from '../../memory/db.js';

// ClawHub 官方仓库 URL
const CLAWHUB_REPO = 'https://raw.githubusercontent.com/openclaw/clawhub/main';

/**
 * 从 ClawHub 安装 Skill
 * 支持格式：
 * - clawhub:skill-name - 从 ClawHub 官方仓库安装
 * - https://github.com/user/repo/blob/main/SKILL.md - 从 GitHub URL 安装
 * - https://raw.githubusercontent.com/.../SKILL.md - 从 raw URL 安装
 */
export async function installSkill(source: string): Promise<{ name: string; description: string }> {
  let content: string;
  let skillName: string;

  // clawhub:skill-name 格式
  if (source.startsWith('clawhub:')) {
    const slug = source.slice(8).toLowerCase();
    // 尝试从 ClawHub 官方仓库获取
    const url = `${CLAWHUB_REPO}/skills/${slug}/SKILL.md`;
    console.log('[InstallSkill] Fetching from ClawHub:', url);

    const res = await fetch(url);
    if (!res.ok) {
      // 尝试备用路径
      const altUrl = `${CLAWHUB_REPO}/skills/${slug}.md`;
      const altRes = await fetch(altUrl);
      if (!altRes.ok) {
        throw new Error(`Skill not found in ClawHub: ${slug}`);
      }
      content = await altRes.text();
    } else {
      content = await res.text();
    }
    skillName = slug;
  }
  // GitHub URL
  else if (source.includes('github.com')) {
    const rawUrl = source
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
    console.log('[InstallSkill] Fetching from GitHub:', rawUrl);

    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
    content = await res.text();
    skillName = source.split('/').pop()?.replace('.md', '') || 'unknown';
  }
  // Raw URL
  else if (source.startsWith('http')) {
    console.log('[InstallSkill] Fetching from URL:', source);
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
    content = await res.text();
    skillName = source.split('/').pop()?.replace('.md', '') || 'unknown';
  }
  // 直接是 SKILL.md 内容
  else if (source.startsWith('---') || source.startsWith('#')) {
    content = source;
    const parsed = parseClawHubSkill(content);
    skillName = parsed.slug;
  }
  else {
    throw new Error('Invalid source format. Use clawhub:name, URL, or SKILL.md content.');
  }

  // 导入到数据库
  const skill = await importFromClawHub(content);

  return {
    name: skill.name,
    description: skill.description || 'No description',
  };
}

/**
 * 搜索 ClawHub Skill（简化版，基于 GitHub API）
 */
export async function searchClawHub(query: string): Promise<Array<{ name: string; description: string; url: string }>> {
  // 由于 ClawHub 没有公开搜索 API，这里返回提示
  // 实际使用时可以调用 GitHub API 搜索 openclaw/clawhub 仓库
  return [
    {
      name: '提示',
      description: `请访问 https://github.com/openclaw/clawhub/tree/main/skills 查看可用 Skill，或使用 install_skill("clawhub:skill-name") 安装。`,
      url: 'https://github.com/openclaw/clawhub/tree/main/skills',
    },
  ];
}

/**
 * 列出已安装的 Skill
 */
export async function listInstalledSkills(): Promise<Array<{ name: string; description: string | null; enabled: boolean }>> {
  const rows = await query<{
    name: string;
    description: string | null;
    enabled: boolean;
  }>('SELECT name, description, enabled FROM skills ORDER BY name');

  return rows;
}

export function registerTools(): void {
  /**
   * install_skill - 从 ClawHub 或 URL 安装 Skill
   */
  registerTool('install_skill', async (args) => {
    const { source } = args as { source: string };

    try {
      const skill = await installSkill(source);
      return `✅ Skill "${skill.name}" installed successfully.\n\nDescription: ${skill.description}\n\nThe skill is now available and can be triggered by its keywords.`;
    } catch (e) {
      return `❌ Failed to install skill: ${e}\n\nUsage:\n- install_skill("clawhub:skill-name") - from ClawHub\n- install_skill("https://github.com/.../SKILL.md") - from URL`;
    }
  });

  /**
   * search_clawhub - 搜索 ClawHub Skill
   */
  registerTool('search_clawhub', async (args) => {
    const { query: searchQuery } = args as { query: string };
    const results = await searchClawHub(searchQuery);
    return results.map(r => `**${r.name}**\n${r.description}\nURL: ${r.url}`).join('\n\n');
  });

  /**
   * list_skills - 列出已安装的 Skill
   */
  registerTool('list_skills', async () => {
    const skills = await listInstalledSkills();
    if (skills.length === 0) {
      return 'No skills installed. Use install_skill("clawhub:name") to install from ClawHub.';
    }
    return skills.map(s => `- **${s.name}** ${s.enabled ? '✅' : '❌'}\n  ${s.description || 'No description'}`).join('\n');
  });
}
