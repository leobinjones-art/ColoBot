/**
 * Trigger 执行引擎
 * 支持: cron / interval / webhook / condition
 */

import { query, queryOne } from '../memory/db.js';
import { listSkills, executeSkill, type Skill } from './skill-runtime.js';

interface Trigger {
  id: string;
  agent_id: string;
  skill_id: string | null;
  type: string;
  config: Record<string, unknown>;
  active: boolean;
  last_fired_at: Date | null;
}

interface TriggerRow {
  id: string;
  agent_id: string;
  skill_id: string | null;
  type: string;
  config: string | Record<string, unknown>;
  active: boolean;
  last_fired_at: Date | null;
}

// 内存中的 interval timers
const intervalTimers = new Map<string, ReturnType<typeof setInterval>>();
let initialized = false;

/**
 * 初始化 Trigger 引擎
 */
export async function initTriggerEngine(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // 加载所有 active triggers
  const triggers = await query<TriggerRow>('SELECT * FROM triggers WHERE active = true');

  for (const row of triggers) {
    const trigger = parseTriggerRow(row);
    startTrigger(trigger);
  }

  console.log(`[TriggerEngine] Initialized with ${triggers.length} active triggers`);
}

/**
 * 启动单个 Trigger
 */
function startTrigger(trigger: Trigger): void {
  switch (trigger.type) {
    case 'interval':
      startIntervalTrigger(trigger);
      break;
    case 'cron':
      startCronTrigger(trigger);
      break;
    // webhook 和 condition 需要外部调用 fire()
  }
}

function startIntervalTrigger(trigger: Trigger): void {
  const intervalMs = (trigger.config.interval_ms as number) || 60_000;
  const timer = setInterval(() => fireTrigger(trigger), intervalMs);
  intervalTimers.set(trigger.id, timer);
  console.log(`[TriggerEngine] Started interval trigger ${trigger.id} every ${intervalMs}ms`);
}

function startCronTrigger(trigger: Trigger): void {
  // 简单 cron 实现: minute hour day-of-month month day-of-week
  const cronExpr = trigger.config.cron as string;
  if (!cronExpr) return;

  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length < 5) return;

  const [minute, hour] = parts;
  const intervalMs = 60_000; // 每分钟检查一次

  const timer = setInterval(() => {
    const now = new Date();
    if (matchesCron(now, parts)) {
      fireTrigger(trigger);
    }
  }, intervalMs);

  intervalTimers.set(trigger.id, timer);
  console.log(`[TriggerEngine] Started cron trigger ${trigger.id} (${cronExpr})`);
}

function matchesCron(now: Date, parts: string[]): boolean {
  const [minute, hour] = parts;
  const m = now.getMinutes();
  const h = now.getHours();

  const matchField = (field: string, value: number): boolean => {
    if (field === '*') return true;
    if (field.includes('/')) {
      const [, step] = field.split('/');
      return value % parseInt(step) === 0;
    }
    if (field.includes(',')) {
      return field.split(',').map(Number).includes(value);
    }
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      return value >= start && value <= end;
    }
    return parseInt(field) === value;
  };

  return matchField(minute, m) && matchField(hour, h);
}

/**
 * 触发 Trigger
 */
export async function fireTrigger(trigger: Trigger): Promise<void> {
  if (!trigger.skill_id) return;

  try {
    const skill = await queryOne<{
      id: string;
      name: string;
      description: string | null;
      markdown_content: string;
      trigger_words: string | string[];
      trigger_config: string | Record<string, unknown>;
      enabled: boolean;
    }>('SELECT * FROM skills WHERE id = $1', [trigger.skill_id]);

    if (!skill || !skill.enabled) {
      console.warn(`[TriggerEngine] Skill ${trigger.skill_id} not found or disabled`);
      return;
    }

    await executeSkill(
      {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        markdown_content: skill.markdown_content,
        trigger_words: typeof skill.trigger_words === 'string' ? JSON.parse(skill.trigger_words) : (skill.trigger_words || []),
        trigger_config: typeof skill.trigger_config === 'string' ? JSON.parse(skill.trigger_config) : (skill.trigger_config || {}),
        enabled: skill.enabled,
      },
      trigger.agent_id,
      { sessionKey: `trigger:${trigger.id}`, userMessage: trigger.config.message as string || 'Scheduled execution' }
    );

    // 更新 last_fired_at
    await query('UPDATE triggers SET last_fired_at = NOW() WHERE id = $1', [trigger.id]);

    // 记录历史
    await query(
      'INSERT INTO trigger_history (id, trigger_id, result) VALUES ($1, $2, $3)',
      [crypto.randomUUID(), trigger.id, JSON.stringify({ fired: true, at: new Date().toISOString() })]
    );

    console.log(`[TriggerEngine] Fired trigger ${trigger.id} -> skill ${skill.name}`);
  } catch (e) {
    console.error(`[TriggerEngine] Error firing trigger ${trigger.id}:`, e);
  }
}

/**
 * Webhook 触发
 */
export async function fireWebhook(
  triggerId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const trigger = await queryOne<TriggerRow>('SELECT * FROM triggers WHERE id = $1 AND type = $2', [triggerId, 'webhook']);
  if (!trigger || !trigger.active) {
    throw new Error(`Webhook trigger not found or inactive: ${triggerId}`);
  }

  await fireTrigger(parseTriggerRow(trigger));
}

/**
 * 创建 Trigger
 */
export async function createTrigger(
  agentId: string,
  skillId: string,
  type: string,
  config: Record<string, unknown>
): Promise<Trigger> {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO triggers (id, agent_id, skill_id, type, config, active)
     VALUES ($1, $2, $3, $4, $5, true)`,
    [id, agentId, skillId, type, JSON.stringify(config)]
  );

  const trigger: Trigger = {
    id,
    agent_id: agentId,
    skill_id: skillId,
    type,
    config,
    active: true,
    last_fired_at: null,
  };

  startTrigger(trigger);
  return trigger;
}

/**
 * 停止 Trigger
 */
export async function stopTrigger(id: string): Promise<void> {
  const timer = intervalTimers.get(id);
  if (timer) {
    clearInterval(timer);
    intervalTimers.delete(id);
  }
  await query('UPDATE triggers SET active = false WHERE id = $1', [id]);
}

function parseTriggerRow(row: TriggerRow): Trigger {
  return {
    id: row.id,
    agent_id: row.agent_id,
    skill_id: row.skill_id,
    type: row.type,
    config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {}),
    active: row.active,
    last_fired_at: row.last_fired_at,
  };
}
