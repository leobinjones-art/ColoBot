/**
 * Trigger 执行引擎
 * 支持: cron / interval / webhook / condition
 */

import { query, queryOne } from '../memory/db.js';
import { executeSkill, type Skill } from '../skill-runtime/index.js';

export interface Trigger {
  id: string;
  agent_id: string;
  skill_id: string | null;
  type: string;
  config: Record<string, unknown>;
  active: boolean;
  last_fired_at: Date | null;
  next_fire_at: Date | null;
}

interface TriggerRow {
  id: string;
  agent_id: string;
  skill_id: string | null;
  type: string;
  config: string | Record<string, unknown>;
  active: boolean;
  last_fired_at: Date | null;
  next_fire_at: Date | null;
}

interface TimerHandle {
  timeout: ReturnType<typeof setTimeout> | null;
  isRunning: boolean;
}

const triggerTimers = new Map<string, TimerHandle>();
let initialized = false;

/**
 * 初始化 Trigger 引擎
 */
export async function initTriggerEngine(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const triggers = await query<TriggerRow>('SELECT * FROM triggers WHERE active = true');

  for (const row of triggers) {
    const trigger = parseTriggerRow(row);
    await startTrigger(trigger);
  }

  console.log(`[TriggerEngine] Initialized with ${triggers.length} active triggers`);
}

async function startTrigger(trigger: Trigger): Promise<void> {
  switch (trigger.type) {
    case 'interval':
      startIntervalTrigger(trigger);
      break;
    case 'cron':
      startCronTrigger(trigger);
      break;
  }
}

function getNextIntervalFire(trigger: Trigger): Date {
  const intervalMs = (trigger.config.interval_ms as number) || 60_000;
  return new Date(Date.now() + intervalMs);
}

function getNextCronFire(cronExpr: string, from: Date = new Date()): Date | null {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length < 5) return null;

  const start = new Date(from.getTime() + 1000);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    const candidate = new Date(start.getTime() + i * 60 * 1000);
    if (matchesCron(candidate, parts)) {
      return candidate;
    }
  }
  return null;
}

function startIntervalTrigger(trigger: Trigger): void {
  const intervalMs = (trigger.config.interval_ms as number) || 60_000;

  const scheduleNextAndFire = async () => {
    const next = new Date(Date.now() + intervalMs);
    await query(
      'UPDATE triggers SET last_fired_at = NOW(), next_fire_at = $1 WHERE id = $2',
      [next, trigger.id]
    );
    trigger.last_fired_at = new Date();
    trigger.next_fire_at = next;

    await fireTrigger(trigger);
    scheduleInterval(trigger, intervalMs);
  };

  if (trigger.next_fire_at) {
    const now = Date.now();
    const nextMs = trigger.next_fire_at.getTime();
    if (nextMs <= now) {
      console.log(`[TriggerEngine] Interval trigger ${trigger.id} missed, firing now`);
      triggerTimers.set(trigger.id, { timeout: null, isRunning: true });
      scheduleNextAndFire().catch(e => {
        console.error(`[TriggerEngine] Error firing missed interval trigger:`, e);
        triggerTimers.delete(trigger.id);
      });
      return;
    } else {
      const delay = nextMs - now;
      triggerTimers.set(trigger.id, { timeout: null, isRunning: true });
      scheduleInterval(trigger, delay);
      return;
    }
  }

  triggerTimers.set(trigger.id, { timeout: null, isRunning: true });
  scheduleInterval(trigger, intervalMs);
}

function scheduleInterval(trigger: Trigger, delayMs: number): void {
  const existing = triggerTimers.get(trigger.id);
  if (existing?.timeout) clearTimeout(existing.timeout);

  const intervalMs = (trigger.config.interval_ms as number) || 60_000;

  const handle: TimerHandle = { timeout: null, isRunning: true };
  triggerTimers.set(trigger.id, handle);

  handle.timeout = setTimeout(async () => {
    if (!triggerTimers.get(trigger.id)?.isRunning) return;

    const next = new Date(Date.now() + intervalMs);
    await query(
      'UPDATE triggers SET last_fired_at = NOW(), next_fire_at = $1 WHERE id = $2',
      [next, trigger.id]
    );
    trigger.last_fired_at = new Date();
    trigger.next_fire_at = next;

    await fireTrigger(trigger);
    scheduleInterval(trigger, intervalMs);
  }, delayMs);
}

async function startCronTrigger(trigger: Trigger): Promise<void> {
  const cronExpr = trigger.config.cron as string;
  if (!cronExpr) return;

  const scheduleNextCron = async () => {
    const next = getNextCronFire(cronExpr, new Date());
    if (next) {
      await query(
        'UPDATE triggers SET last_fired_at = NOW(), next_fire_at = $1 WHERE id = $2',
        [next, trigger.id]
      );
      trigger.last_fired_at = new Date();
      trigger.next_fire_at = next;
    }
    return next;
  };

  if (trigger.next_fire_at) {
    const now = Date.now();
    const nextMs = trigger.next_fire_at.getTime();
    if (nextMs <= now) {
      console.log(`[TriggerEngine] Cron trigger ${trigger.id} missed, firing now`);
      triggerTimers.set(trigger.id, { timeout: null, isRunning: true });
      const next = await scheduleNextCron();
      if (next) await fireTrigger(trigger);
      scheduleCron(trigger, cronExpr);
      return;
    } else {
      const delay = nextMs - now;
      triggerTimers.set(trigger.id, { timeout: null, isRunning: true });
      scheduleCronDelayed(trigger, cronExpr, delay);
      return;
    }
  }

  triggerTimers.set(trigger.id, { timeout: null, isRunning: true });
  scheduleCron(trigger, cronExpr);
}

function scheduleCron(trigger: Trigger, cronExpr: string): void {
  const next = getNextCronFire(cronExpr, new Date());
  if (!next) return;

  const delay = next.getTime() - Date.now();
  scheduleCronDelayed(trigger, cronExpr, delay);
}

function scheduleCronDelayed(trigger: Trigger, cronExpr: string, delayMs: number): void {
  const existing = triggerTimers.get(trigger.id);
  if (existing?.timeout) clearTimeout(existing.timeout);

  const handle: TimerHandle = { timeout: null, isRunning: true };
  triggerTimers.set(trigger.id, handle);

  handle.timeout = setTimeout(async () => {
    if (!triggerTimers.get(trigger.id)?.isRunning) return;

    const next = getNextCronFire(cronExpr, new Date());
    if (next) {
      await query(
        'UPDATE triggers SET last_fired_at = NOW(), next_fire_at = $1 WHERE id = $2',
        [next, trigger.id]
      );
      trigger.last_fired_at = new Date();
      trigger.next_fire_at = next;
    }

    await fireTrigger(trigger);
    scheduleCron(trigger, cronExpr);
  }, delayMs);
}

function matchesCron(now: Date, parts: string[]): boolean {
  const [minute, hour, dom, month, dow] = parts;
  const m = now.getMinutes();
  const h = now.getHours();
  const d = now.getDate();
  const mo = now.getMonth() + 1;
  const w = now.getDay();

  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const matchField = (field: string, value: number, lastDay?: number): boolean => {
    if (field === '*' || field === '?') return true;
    if (field === 'L') return lastDay !== undefined && value === lastDay;
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
    matchField(dom, d, lastDayOfMonth) &&
    matchField(month, mo) &&
    matchField(dow, w)
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

    const skillObj: Skill = {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      markdown_content: skill.markdown_content,
      trigger_words: typeof skill.trigger_words === 'string' ? JSON.parse(skill.trigger_words) : (skill.trigger_words || []),
      trigger_config: typeof skill.trigger_config === 'string' ? JSON.parse(skill.trigger_config) : (skill.trigger_config || {}),
      enabled: skill.enabled,
    };

    await executeSkill(skillObj, trigger.agent_id, {
      sessionKey: `trigger:${trigger.id}`,
      userMessage: trigger.config.message as string || 'Scheduled execution'
    });

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
export async function fireWebhook(triggerId: string, _payload: Record<string, unknown>): Promise<void> {
  const trigger = await queryOne<TriggerRow>('SELECT * FROM triggers WHERE id = $1 AND type = $2', [triggerId, 'webhook']);
  if (!trigger || !trigger.active) {
    throw new Error(`Webhook trigger not found or inactive: ${triggerId}`);
  }

  await fireTrigger(parseTriggerRow(trigger));
}

/**
 * Condition 触发
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
    await fireTrigger(parsed);
    return { triggered: true };
  }

  const result = evaluateCondition(condition, { ...context, _trigger: parsed.config });
  if (result) {
    await fireTrigger(parsed);
    return { triggered: true };
  }

  return { triggered: false, reason: 'Condition not met' };
}

function evaluateCondition(condition: Record<string, unknown>, context: Record<string, unknown>): boolean {
  if ('and' in condition) {
    const conditions = condition.and as Record<string, unknown>[];
    return conditions.every(c => evaluateCondition(c, context));
  }

  if ('or' in condition) {
    const conditions = condition.or as Record<string, unknown>[];
    return conditions.some(c => evaluateCondition(c, context));
  }

  if ('not' in condition) {
    return !evaluateCondition(condition.not as Record<string, unknown>, context);
  }

  const field = String(condition.field || '');
  const operator = String(condition.operator || 'eq');
  const expected = condition.value;

  const fieldValue = field.split('.').reduce((obj: unknown, key: string) => {
    if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[key];
    return undefined;
  }, context);

  switch (operator) {
    case 'eq': return fieldValue === expected;
    case 'ne': return fieldValue !== expected;
    case 'gt': return Number(fieldValue) > Number(expected);
    case 'gte': return Number(fieldValue) >= Number(expected);
    case 'lt': return Number(fieldValue) < Number(expected);
    case 'lte': return Number(fieldValue) <= Number(expected);
    case 'contains': return String(fieldValue).includes(String(expected));
    case 'in': return Array.isArray(expected) && expected.includes(fieldValue);
    case 'exists': return fieldValue !== undefined && fieldValue !== null;
    default: return false;
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
  let nextFireAt: Date | null = null;

  if (type === 'interval') {
    const intervalMs = (config.interval_ms as number) || 60_000;
    nextFireAt = new Date(Date.now() + intervalMs);
  } else if (type === 'cron') {
    const cronExpr = config.cron as string;
    if (cronExpr) {
      nextFireAt = getNextCronFire(cronExpr, new Date());
    }
  }

  await query(
    `INSERT INTO triggers (id, agent_id, skill_id, type, config, active, next_fire_at)
     VALUES ($1, $2, $3, $4, $5, true, $6)`,
    [id, agentId, skillId, type, JSON.stringify(config), nextFireAt]
  );

  const trigger: Trigger = {
    id,
    agent_id: agentId,
    skill_id: skillId,
    type,
    config,
    active: true,
    last_fired_at: null,
    next_fire_at: nextFireAt,
  };

  startTrigger(trigger);
  return trigger;
}

/**
 * 停止 Trigger
 */
export async function stopTrigger(id: string): Promise<void> {
  const handle = triggerTimers.get(id);
  if (handle) {
    if (handle.timeout) clearTimeout(handle.timeout);
    handle.isRunning = false;
    triggerTimers.delete(id);
  }
  await query('UPDATE triggers SET active = false, next_fire_at = NULL WHERE id = $1', [id]);
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
    next_fire_at: row.next_fire_at,
  };
}
