/**
 * 安全写入包装器
 */

import { query } from '../memory/db.js';
import {
  checkWritePermission,
  recordPoisoningAttempt,
  type ContentSource,
  type WriteRequest,
} from '../content/poison-defense.js';
import { addMemory } from '../memory/vector.js';

/**
 * 安全写入记忆
 */
export async function safeAddMemory(
  agentId: string,
  key: string,
  value: string,
  metadata: Record<string, unknown> = {},
  source: ContentSource = { type: 'ai_generated', timestamp: new Date().toISOString() }
): Promise<{ success: boolean; reason?: string }> {
  const request: WriteRequest = {
    agentId,
    contentType: 'memory',
    contentKey: key,
    content: value,
    source,
  };

  const result = await checkWritePermission(request);

  if (!result.allowed) {
    return { success: false, reason: result.reason };
  }

  await addMemory(agentId, key, value, metadata);
  return { success: true };
}

/**
 * 安全写入 Skill
 */
export async function safeUpsertSkill(
  name: string,
  markdownContent: string,
  triggerWords: string[] = [],
  triggerConfig: Record<string, unknown> = {},
  agentId: string,
  source: ContentSource = { type: 'ai_generated', timestamp: new Date().toISOString() }
): Promise<{ success: boolean; reason?: string }> {
  const request: WriteRequest = {
    agentId,
    contentType: 'skill',
    contentKey: name,
    content: markdownContent,
    source,
  };

  const result = await checkWritePermission(request);

  if (!result.allowed) {
    return { success: false, reason: result.reason };
  }

  await query(
    `INSERT INTO skills (name, markdown_content, trigger_words, trigger_config)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (name) DO UPDATE SET
       markdown_content = EXCLUDED.markdown_content,
       trigger_words = EXCLUDED.trigger_words,
       trigger_config = EXCLUDED.trigger_config,
       updated_at = NOW()`,
    [name, markdownContent, JSON.stringify(triggerWords), JSON.stringify(triggerConfig)]
  );

  return { success: true };
}

/**
 * 安全写入用户画像
 */
export async function safeUpsertUserProfile(
  agentId: string,
  update: Record<string, unknown>,
  source: ContentSource = { type: 'ai_generated', timestamp: new Date().toISOString() }
): Promise<{ success: boolean; reason?: string }> {
  const request: WriteRequest = {
    agentId,
    contentType: 'profile',
    contentKey: 'profile',
    content: JSON.stringify(update),
    source,
  };

  const result = await checkWritePermission(request);

  if (!result.allowed) {
    return { success: false, reason: result.reason };
  }

  const { upsertUserProfile } = await import('./user-profile.js');
  await upsertUserProfile(agentId, update as any);

  return { success: true };
}

/**
 * 安全写入知识库
 */
export async function safeUpsertKnowledge(
  category: string,
  name: string,
  content: string,
  agentId: string,
  source: ContentSource = { type: 'ai_generated', timestamp: new Date().toISOString() }
): Promise<{ success: boolean; reason?: string }> {
  const request: WriteRequest = {
    agentId,
    contentType: 'knowledge',
    contentKey: `${category}/${name}`,
    content,
    source,
  };

  const result = await checkWritePermission(request);

  if (!result.allowed) {
    return { success: false, reason: result.reason };
  }

  await query(
    `INSERT INTO knowledge_base (category, name, content)
     VALUES ($1, $2, $3)
     ON CONFLICT (category, name) DO UPDATE SET
       content = EXCLUDED.content,
       updated_at = NOW()`,
    [category, name, content]
  );

  return { success: true };
}

/**
 * 安全写入规则
 */
export async function safeUpsertRule(
  ruleName: string,
  pattern: string,
  patternType: string,
  action: string,
  agentId: string,
  source: ContentSource = { type: 'ai_generated', timestamp: new Date().toISOString() }
): Promise<{ success: boolean; reason?: string }> {
  const request: WriteRequest = {
    agentId,
    contentType: 'rule',
    contentKey: ruleName,
    content: JSON.stringify({ pattern, patternType, action }),
    source,
  };

  const result = await checkWritePermission(request);

  if (!result.allowed) {
    return { success: false, reason: result.reason };
  }

  await query(
    `INSERT INTO approval_rules (name, pattern, pattern_type, action)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (name) DO UPDATE SET
       pattern = EXCLUDED.pattern,
       pattern_type = EXCLUDED.pattern_type,
       action = EXCLUDED.action`,
    [ruleName, pattern, patternType, action]
  );

  return { success: true };
}
