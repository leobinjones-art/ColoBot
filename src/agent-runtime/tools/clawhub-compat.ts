/**
 * ClawHub 兼容层 - 双向 Skill 格式转换
 *
 * ClawHub Skill 格式（SKILL.md with YAML frontmatter）:
 * ---
 * name: skill-name
 * description: Skill description
 * version: 1.0.0
 * tags: [tag1, tag2]
 * metadata:
 *   clawdis:
 *     emoji: "🤖"
 *     homepage: "https://..."
 * ---
 *
 * # Skill Name
 * Markdown content...
 */

import { query, queryOne } from '../../memory/db.js';

// ─── ClawHub Skill 格式定义 ─────────────────────────────────────────

export interface ClawHubSkillFrontmatter {
  name: string;
  description?: string;
  version?: string;
  tags?: string[];
  homepage?: string;
  emoji?: string;
  author?: string;
  metadata?: {
    clawdis?: {
      emoji?: string;
      homepage?: string;
      skillKey?: string;
      primaryEnv?: string;
      requires?: {
        bins?: string[];
        env?: string[];
        config?: string[];
      };
      install?: Array<{
        kind: 'apt' | 'brew' | 'npm' | 'pip' | 'nix' | 'script';
        spec: string;
      }>;
      envVars?: Array<{
        name: string;
        description?: string;
        required?: boolean;
        default?: string;
      }>;
    };
  };
}

export interface ClawHubSkill {
  slug: string;
  displayName: string;
  summary?: string;
  version: string;
  readme: string;
  files?: Array<{
    path: string;
    content: string;
  }>;
  tags?: string[];
  author?: string;
  homepage?: string;
  emoji?: string;
  source?: {
    kind: 'github';
    url: string;
    repo: string;
  };
}

// ─── ColoBot Skill 格式 ─────────────────────────────────────────────

export interface ColoBotSkill {
  id: string;
  name: string;
  description?: string;
  markdown_content: string;
  trigger_words: string[];
  trigger_config?: Record<string, unknown>;
  enabled: boolean;
  version?: string;
  author?: string;
  homepage?: string;
  source?: 'local' | 'clawhub';
  clawhub_slug?: string;
}

// ─── 解析 ClawHub SKILL.md ──────────────────────────────────────────

/**
 * 解析 YAML frontmatter
 */
function parseYamlFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const FRONTMATTER_START = '---';
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (!normalized.startsWith(FRONTMATTER_START)) {
    return { frontmatter: {}, body: content };
  }

  const endIndex = normalized.indexOf(`\n${FRONTMATTER_START}`, 3);
  if (endIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  const block = normalized.slice(4, endIndex);
  const body = normalized.slice(endIndex + 4).trim();

  // 简单 YAML 解析（不支持复杂嵌套）
  const frontmatter: Record<string, unknown> = {};

  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // key: value
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (!key || !/^[\w-]+$/.test(key)) continue;

    // 解析值
    if (value.startsWith('[') && value.endsWith(']')) {
      // 数组: [a, b, c]
      const items = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      frontmatter[key] = items;
    } else if (value.startsWith('"') && value.endsWith('"')) {
      frontmatter[key] = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      frontmatter[key] = value.slice(1, -1);
    } else if (value === 'true' || value === 'false') {
      frontmatter[key] = value === 'true';
    } else if (/^\d+$/.test(value)) {
      frontmatter[key] = parseInt(value, 10);
    } else if (/^\d+\.\d+$/.test(value)) {
      frontmatter[key] = parseFloat(value);
    } else {
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

/**
 * 解析 ClawHub SKILL.md 文件
 */
export function parseClawHubSkill(content: string): ClawHubSkill {
  const { frontmatter, body } = parseYamlFrontmatter(content);

  const name = (frontmatter.name as string) || 'unknown-skill';
  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // 提取 clawdis metadata
  const metadata = frontmatter.metadata as Record<string, unknown> | undefined;
  const clawdis = metadata?.clawdis as Record<string, unknown> | undefined;

  return {
    slug,
    displayName: name,
    summary: (frontmatter.description as string) || undefined,
    version: (frontmatter.version as string) || '1.0.0',
    readme: body,
    tags: (frontmatter.tags as string[]) || [],
    author: (frontmatter.author as string) || (clawdis?.author as string) || undefined,
    homepage: (frontmatter.homepage as string) || (clawdis?.homepage as string) || undefined,
    emoji: (frontmatter.emoji as string) || (clawdis?.emoji as string) || undefined,
  };
}

// ─── ColoBot → ClawHub 转换 ─────────────────────────────────────────

/**
 * 将 ColoBot Skill 转换为 ClawHub 格式
 */
export function toClawHubSkill(skill: ColoBotSkill): string {
  const frontmatter: ClawHubSkillFrontmatter = {
    name: skill.name,
    description: skill.description,
    version: skill.version || '1.0.0',
    tags: skill.trigger_words,
  };

  if (skill.homepage) frontmatter.homepage = skill.homepage;
  if (skill.author) frontmatter.author = skill.author;

  // 构建 YAML frontmatter
  const yamlLines = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      yamlLines.push(`${key}: [${value.map(v => `"${v}"`).join(', ')}]`);
    } else if (typeof value === 'string') {
      yamlLines.push(`${key}: "${value}"`);
    } else {
      yamlLines.push(`${key}: ${value}`);
    }
  }
  yamlLines.push('---');

  const markdown = skill.markdown_content || `# ${skill.name}\n\n${skill.description || 'A ColoBot skill.'}`;

  return `${yamlLines.join('\n')}\n\n${markdown}`;
}

// ─── ClawHub → ColoBot 转换 ─────────────────────────────────────────

/**
 * 将 ClawHub Skill 转换为 ColoBot 格式
 */
export function toColoBotSkill(clawhub: ClawHubSkill): ColoBotSkill {
  return {
    id: crypto.randomUUID(),
    name: clawhub.displayName,
    description: clawhub.summary,
    markdown_content: clawhub.readme,
    trigger_words: clawhub.tags || [],
    trigger_config: {},
    enabled: true,
    version: clawhub.version,
    author: clawhub.author,
    homepage: clawhub.homepage,
    source: 'clawhub',
    clawhub_slug: clawhub.slug,
  };
}

// ─── 导入/导出 API ──────────────────────────────────────────────────

/**
 * 从 ClawHub 格式导入 Skill
 */
export async function importFromClawHub(
  content: string,
  agentId?: string
): Promise<ColoBotSkill> {
  const clawhub = parseClawHubSkill(content);
  const colobot = toColoBotSkill(clawhub);

  // 写入数据库
  await query(
    `INSERT INTO skills (id, name, description, markdown_content, trigger_words, trigger_config, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     ON CONFLICT (name) DO UPDATE SET
       description = $3, markdown_content = $4, trigger_words = $5, updated_at = NOW()`,
    [colobot.id, colobot.name, colobot.description || '', colobot.markdown_content, JSON.stringify(colobot.trigger_words), JSON.stringify(colobot.trigger_config)]
  );

  // 记录导入来源
  if (colobot.clawhub_slug) {
    await query(
      `INSERT INTO knowledge_base (id, category, name, content, variables, related)
       VALUES ($1, 'template', $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [crypto.randomUUID(), `clawhub_import:${colobot.clawhub_slug}`, JSON.stringify({ slug: colobot.clawhub_slug, version: colobot.version }), [], []]
    );
  }

  console.log('[ClawHub] Imported skill:', colobot.name);
  return colobot;
}

/**
 * 导出 Skill 为 ClawHub 格式
 */
export async function exportToClawHub(skillId: string): Promise<string> {
  const row = await queryOne<{
    name: string;
    description: string | null;
    markdown_content: string;
    trigger_words: string | string[];
  }>('SELECT * FROM skills WHERE id = $1', [skillId]);

  if (!row) throw new Error(`Skill not found: ${skillId}`);

  const skill: ColoBotSkill = {
    id: skillId,
    name: row.name,
    description: row.description || undefined,
    markdown_content: row.markdown_content,
    trigger_words: typeof row.trigger_words === 'string' ? JSON.parse(row.trigger_words) : (row.trigger_words || []),
    enabled: true,
  };

  return toClawHubSkill(skill);
}

/**
 * 批量导出所有 Skill 为 ClawHub 格式
 */
export async function exportAllToClawHub(): Promise<string> {
  const rows = await query<{
    id: string;
    name: string;
    description: string | null;
    markdown_content: string;
    trigger_words: string | string[];
  }>('SELECT * FROM skills WHERE enabled = true ORDER BY name');

  const exports: string[] = [];

  for (const row of rows) {
    const skill: ColoBotSkill = {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      markdown_content: row.markdown_content,
      trigger_words: typeof row.trigger_words === 'string' ? JSON.parse(row.trigger_words) : (row.trigger_words || []),
      enabled: true,
    };
    exports.push(toClawHubSkill(skill));
  }

  // 返回多文件格式（每个 Skill 用 --- 分隔）
  return exports.join('\n\n---\n\n');
}

/**
 * 从 ClawHub URL 导入（GitHub raw 文件）
 */
export async function importFromClawHubUrl(url: string): Promise<ColoBotSkill> {
  // 支持 GitHub raw URL
  const rawUrl = url.includes('github.com')
    ? url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
    : url;

  const res = await fetch(rawUrl);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);

  const content = await res.text();
  return importFromClawHub(content);
}