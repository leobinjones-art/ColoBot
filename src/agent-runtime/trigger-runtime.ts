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

  // 检查是否错过了触发（服务器重启前 timer 已到期）
  if (trigger.last_fired_at) {
    const elapsed = Date.now() - trigger.last_fired_at.getTime();
    if (elapsed >= intervalMs) {
      // 错过了，直接触发一次
      console.log(`[TriggerEngine] Interval trigger ${trigger.id} missed, firing immediately`);
      fireTrigger(trigger);
    }
  }

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
  const [minute, hour, dom, month, dow] = parts;
  const m = now.getMinutes();
  const h = now.getHours();
  const d = now.getDate();
  const mo = now.getMonth() + 1; // getMonth() is 0-indexed
  const w = now.getDay(); // 0 = Sunday

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

  return (
    matchField(minute, m) &&
    matchField(hour, h) &&
    (dom === '*' || matchField(dom, d)) &&
    (month === '*' || matchField(month, mo)) &&
    (dow === '*' || matchField(dow, w))
  );
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
 * Condition 触发
 * 评估条件，满足时触发
 */
export async function fireConditionTrigger(
  triggerId: string,
  context: Record<string, unknown> = {}
): Promise<{ triggered: boolean; reason?: string }> {
  const trigger = await queryOne<TriggerRow>('SELECT * FROM triggers WHERE id = $1 AND type = $2', [triggerId, 'condition']);
  if (!trigger || !trigger.active) {
    return { triggered: false, reason: 'Trigger not found or inactive' };
  }

  const parsed = parseTriggerRow(trigger);
  const condition = parsed.config.condition as Record<string, unknown> | undefined;

  if (!condition) {
    // 无条件，直接触发
    await fireTrigger(parsed);
    return { triggered: true };
  }

  // 简单条件评估
  const result = evaluateCondition(condition, { ...context, _trigger: parsed.config });
  if (result) {
    await fireTrigger(parsed);
    return { triggered: true };
  }

  return { triggered: false, reason: 'Condition not met' };
}

/**
 * 评估条件表达式
 * 支持简单比较: { field: "value", operator: "eq", value: "expected" }
 * 或组合: { and: [...], or: [...] }
 */
function evaluateCondition(
  condition: Record<string, unknown>,
  context: Record<string, unknown>
): boolean {
  // 组合条件: AND
  if ('and' in condition) {
    const conditions = (condition.and as Record<string, unknown>[]);
    return conditions.every(c => evaluateCondition(c, context));
  }

  // 组合条件: OR
  if ('or' in condition) {
    const conditions = (condition.or as Record<string, unknown>[]);
    return conditions.some(c => evaluateCondition(c, context));
  }

  // 组合条件: NOT
  if ('not' in condition) {
    return !evaluateCondition(condition.not as Record<string, unknown>, context);
  }

  // 简单比较 { field: "path.to.field", operator: "eq", value: "expected" }
  const field = String(condition.field || '');
  const operator = String(condition.operator || 'eq');
  const expected = condition.value;

  // 支持嵌套字段路径 (e.g., "payload.price")
  const fieldValue = field.split('.').reduce((obj: unknown, key: string) => {
    if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[key];
    return undefined;
  }, context);

  switch (operator) {
    case 'eq':
      return fieldValue === expected;
    case 'ne':
      return fieldValue !== expected;
    case 'gt':
      return Number(fieldValue) > Number(expected);
    case 'gte':
      return Number(fieldValue) >= Number(expected);
    case 'lt':
      return Number(fieldValue) < Number(expected);
    case 'lte':
      return Number(fieldValue) <= Number(expected);
    case 'contains':
      return String(fieldValue).includes(String(expected));
    case 'in':
      return Array.isArray(expected) && expected.includes(fieldValue);
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;
    case 'now':
      // { "now": { "after": "09:00", "before": "17:00" } } - 时间窗口
      const nowTimeConfig = (condition as Record<string, { after?: string; before?: string }>).now || {};
      const now = new Date();
      const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (nowTimeConfig.after && nowTime < nowTimeConfig.after) return false;
      if (nowTimeConfig.before && nowTime > nowTimeConfig.before) return false;
      return true;
    default:
      return false;
  }
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
