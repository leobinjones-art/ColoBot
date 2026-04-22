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
  await addMemory(agentId, 'user_profile', content, {
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
