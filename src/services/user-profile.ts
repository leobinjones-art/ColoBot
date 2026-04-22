/**
 * 用户画像服务 - 管理用户个人信息、偏好、背景
 */

import { query, queryOne } from '../memory/db.js';
import { addMemory, searchMemory } from '../memory/vector.js';

export type UserRole = 'student' | 'researcher' | 'developer' | 'writer' | 'other';
export type ExpertiseLevel = 'beginner' | 'intermediate' | 'expert';

export interface UserProfile {
  id: string;
  agent_id: string;

  // 基本信息
  name?: string;
  role?: UserRole;
  organization?: string;
  bio?: string;

  // 专业背景
  expertise_level?: ExpertiseLevel;
  research_fields?: string[];
  skills?: string[];
  languages?: string[];

  // 偏好设置
  communication_style?: 'formal' | 'casual' | 'technical';
  response_length?: 'brief' | 'detailed' | 'comprehensive';
  preferred_language?: string;

  // 学习/研究目标
  goals?: string[];
  current_projects?: string[];

  // 元数据
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  name?: string;
  role?: UserRole;
  organization?: string;
  bio?: string;
  expertise_level?: ExpertiseLevel;
  research_fields?: string[];
  skills?: string[];
  languages?: string[];
  communication_style?: 'formal' | 'casual' | 'technical';
  response_length?: 'brief' | 'detailed' | 'comprehensive';
  preferred_language?: string;
  goals?: string[];
  current_projects?: string[];
}

/**
 * 获取用户画像
 */
export async function getUserProfile(agentId: string): Promise<UserProfile | null> {
  const row = await queryOne<{
    id: string;
    agent_id: string;
    name: string | null;
    role: string | null;
    organization: string | null;
    bio: string | null;
    expertise_level: string | null;
    research_fields: string | string[] | null;
    skills: string | string[] | null;
    languages: string | string[] | null;
    communication_style: string | null;
    response_length: string | null;
    preferred_language: string | null;
    goals: string | string[] | null;
    current_projects: string | string[] | null;
    created_at: string;
    updated_at: string;
  }>(
    'SELECT * FROM user_profiles WHERE agent_id = $1',
    [agentId]
  );

  if (!row) return null;

  return {
    id: row.id,
    agent_id: row.agent_id,
    name: row.name || undefined,
    role: row.role as UserRole || undefined,
    organization: row.organization || undefined,
    bio: row.bio || undefined,
    expertise_level: row.expertise_level as ExpertiseLevel || undefined,
    research_fields: parseArray(row.research_fields),
    skills: parseArray(row.skills),
    languages: parseArray(row.languages),
    communication_style: row.communication_style as 'formal' | 'casual' | 'technical' || undefined,
    response_length: row.response_length as 'brief' | 'detailed' | 'comprehensive' || undefined,
    preferred_language: row.preferred_language || undefined,
    goals: parseArray(row.goals),
    current_projects: parseArray(row.current_projects),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * 创建或更新用户画像
 */
export async function upsertUserProfile(
  agentId: string,
  update: ProfileUpdate
): Promise<UserProfile> {
  const existing = await getUserProfile(agentId);

  if (existing) {
    // 更新
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fields: Array<keyof ProfileUpdate> = [
      'name', 'role', 'organization', 'bio', 'expertise_level',
      'research_fields', 'skills', 'languages', 'communication_style',
      'response_length', 'preferred_language', 'goals', 'current_projects'
    ];

    for (const field of fields) {
      if (update[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(Array.isArray(update[field]) ? JSON.stringify(update[field]) : update[field]);
        paramIndex++;
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      values.push(agentId);
      await query(
        `UPDATE user_profiles SET ${updates.join(', ')} WHERE agent_id = $${paramIndex}`,
        values
      );
    }

    // 同步到记忆
    await syncProfileToMemory(agentId, { ...existing, ...update } as UserProfile);

    return (await getUserProfile(agentId))!;
  } else {
    // 创建
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO user_profiles (
        id, agent_id, name, role, organization, bio, expertise_level,
        research_fields, skills, languages, communication_style,
        response_length, preferred_language, goals, current_projects
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id, agentId,
        update.name || null,
        update.role || null,
        update.organization || null,
        update.bio || null,
        update.expertise_level || null,
        JSON.stringify(update.research_fields || []),
        JSON.stringify(update.skills || []),
        JSON.stringify(update.languages || []),
        update.communication_style || null,
        update.response_length || null,
        update.preferred_language || null,
        JSON.stringify(update.goals || []),
        JSON.stringify(update.current_projects || []),
      ]
    );

    const profile = await getUserProfile(agentId);
    if (profile) {
      await syncProfileToMemory(agentId, profile);
    }

    return profile!;
  }
}

/**
 * 删除用户画像
 */
export async function deleteUserProfile(agentId: string): Promise<void> {
  await query('DELETE FROM user_profiles WHERE agent_id = $1', [agentId]);
}

/**
 * 同步画像到记忆（便于 Agent 检索）
 */
async function syncProfileToMemory(agentId: string, profile: UserProfile): Promise<void> {
  const content = buildProfileSummary(profile);
  // 使用安全写入
  const { safeAddMemory } = await import('./safe-write.js');
  await safeAddMemory(agentId, 'user_profile', content, {
    type: 'user_profile',
    role: profile.role,
    expertise_level: profile.expertise_level,
  });
}

/**
 * 构建画像摘要文本
 */
function buildProfileSummary(profile: UserProfile): string {
  const parts: string[] = [];

  if (profile.name) parts.push(`姓名：${profile.name}`);
  if (profile.role) parts.push(`角色：${getRoleLabel(profile.role)}`);
  if (profile.organization) parts.push(`所属机构：${profile.organization}`);
  if (profile.bio) parts.push(`简介：${profile.bio}`);
  if (profile.expertise_level) parts.push(`专业水平：${getExpertiseLabel(profile.expertise_level)}`);
  if (profile.research_fields?.length) parts.push(`研究领域：${profile.research_fields.join('、')}`);
  if (profile.skills?.length) parts.push(`技能：${profile.skills.join('、')}`);
  if (profile.languages?.length) parts.push(`语言：${profile.languages.join('、')}`);
  if (profile.goals?.length) parts.push(`目标：${profile.goals.join('、')}`);
  if (profile.current_projects?.length) parts.push(`当前项目：${profile.current_projects.join('、')}`);

  return parts.join('\n');
}

/**
 * 从画像生成系统提示词增强
 */
export function buildProfilePrompt(profile: UserProfile | null): string {
  if (!profile) return '';

  const parts: string[] = ['## 用户画像'];

  if (profile.role) {
    parts.push(`用户是一位${getRoleLabel(profile.role)}${profile.organization ? `，来自${profile.organization}` : ''}。`);
  }

  if (profile.expertise_level) {
    const levelDesc = profile.expertise_level === 'beginner' ? '初学者' :
                      profile.expertise_level === 'intermediate' ? '有一定经验' : '专家级';
    parts.push(`专业水平：${levelDesc}。`);
  }

  if (profile.research_fields?.length) {
    parts.push(`研究领域：${profile.research_fields.join('、')}。`);
  }

  if (profile.skills?.length) {
    parts.push(`擅长技能：${profile.skills.join('、')}。`);
  }

  if (profile.communication_style) {
    const styleDesc = profile.communication_style === 'formal' ? '正式、专业' :
                      profile.communication_style === 'casual' ? '轻松、友好' : '技术性、详细';
    parts.push(`沟通风格：${styleDesc}。`);
  }

  if (profile.response_length) {
    const lengthDesc = profile.response_length === 'brief' ? '简洁' :
                       profile.response_length === 'detailed' ? '详细' : '全面深入';
    parts.push(`回复长度偏好：${lengthDesc}。`);
  }

  if (profile.goals?.length) {
    parts.push(`用户目标：${profile.goals.join('、')}。`);
  }

  return parts.join('\n');
}

/**
 * 获取用户画像摘要（供 Agent 快速了解用户）
 */
export async function getProfileSummary(agentId: string): Promise<string> {
  const profile = await getUserProfile(agentId);
  if (!profile) return '用户画像未设置。';

  return buildProfileSummary(profile);
}

// ─── 画像自进化 ─────────────────────────────────────────────────

interface ProfileUpdateHint {
  field: string;
  value: string | string[];
  confidence: number;
  source: string;
}

/**
 * 从对话中分析用户信息，提取画像更新建议
 */
export async function analyzeConversationForProfile(
  agentId: string,
  conversation: Array<{ role: string; content: string }>
): Promise<ProfileUpdateHint[]> {
  const { chat } = await import('../llm/index.js');

  // 获取现有画像作为上下文
  const existingProfile = await getUserProfile(agentId);
  const existingSummary = existingProfile ? buildProfileSummary(existingProfile) : '无';

  const prompt = `分析以下对话，提取用户画像信息。

现有画像：
${existingSummary}

对话内容：
"""
${conversation.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n')}
"""

请以 JSON 数组格式回复，提取对话中透露的用户信息：
[
  {
    "field": "name|role|organization|bio|expertise_level|research_fields|skills|languages|goals|current_projects",
    "value": "提取的值（字符串或数组）",
    "confidence": 0.0-1.0,
    "source": "对话中的原文引用"
  }
]

注意：
1. 只提取明确透露的信息，不要猜测
2. confidence 表示信息的确信程度
3. 数组类型字段（research_fields, skills, languages, goals, current_projects）用 JSON 数组
4. role 只能是: student, researcher, developer, writer, other
5. expertise_level 只能是: beginner, intermediate, expert
6. 如果没有新信息，返回空数组 []
7. 只回复 JSON，不要其他内容`;

  try {
    const response = await chat([{ role: 'user', content: prompt }], {
      maxTokens: 500,
      temperature: 0.3,
    });

    const text = typeof response.content === 'string' ? response.content : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const hints = JSON.parse(jsonMatch[0]) as ProfileUpdateHint[];
    return hints.filter(h => h.confidence >= 0.7); // 只采纳高置信度的信息
  } catch (e) {
    console.error('[Profile] Analysis failed:', e);
    return [];
  }
}

/**
 * 应用画像更新建议
 */
export async function applyProfileHints(
  agentId: string,
  hints: ProfileUpdateHint[]
): Promise<void> {
  if (hints.length === 0) return;

  const update: ProfileUpdate = {};
  const profile = await getUserProfile(agentId);

  for (const hint of hints) {
    // 检查是否已有该信息（避免覆盖）
    if (profile && profile[hint.field as keyof UserProfile]) {
      // 合并数组类型
      if (Array.isArray(hint.value) && Array.isArray(profile[hint.field as keyof UserProfile])) {
        const existing = profile[hint.field as keyof UserProfile] as string[];
        const newItems = (hint.value as string[]).filter(item => !existing.includes(item));
        if (newItems.length > 0) {
          (update as Record<string, unknown>)[hint.field] = [...existing, ...newItems];
        }
      }
      // 跳过已有非数组字段
      continue;
    }

    (update as Record<string, unknown>)[hint.field] = hint.value;
  }

  if (Object.keys(update).length > 0) {
    await upsertUserProfile(agentId, update);
    console.log('[Profile] Auto-updated:', Object.keys(update).join(', '));
  }
}

/**
 * 从对话中自动进化画像（主入口）
 */
export async function evolveProfileFromConversation(
  agentId: string,
  conversation: Array<{ role: string; content: string }>
): Promise<void> {
  // 每隔一定对话轮次才分析（避免频繁调用）
  const profile = await getUserProfile(agentId);
  const lastAnalyzedAt = profile?.updated_at || profile?.created_at;

  if (lastAnalyzedAt) {
    const hoursSinceLastUpdate = (Date.now() - new Date(lastAnalyzedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastUpdate < 1) {
      // 1小时内不重复分析
      return;
    }
  }

  const hints = await analyzeConversationForProfile(agentId, conversation);
  if (hints.length > 0) {
    await applyProfileHints(agentId, hints);
  }
}

// 辅助函数

function parseArray(value: string | string[] | null): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    student: '学生',
    researcher: '研究人员',
    developer: '开发者',
    writer: '写作者',
    other: '其他',
  };
  return labels[role] || role;
}

function getExpertiseLabel(level: ExpertiseLevel): string {
  const labels: Record<ExpertiseLevel, string> = {
    beginner: '初学者',
    intermediate: '中级',
    expert: '专家',
  };
  return labels[level] || level;
}
