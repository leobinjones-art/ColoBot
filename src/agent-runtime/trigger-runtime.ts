/**
 * Trigger 执行引擎
 * 支持: cron / interval / webhook / condition
 *
 * 持久化设计：
 * - 每次触发后计算并保存 next_fire_at（下次应触发时间）
 * - 服务器重启时检查 next_fire_at，如有错过则立即触发一次进行补偿
 */

import { query, queryOne } from '../memory/db.js';
import { executeSkill } from './skill-runtime.js';

interface Trigger {
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

// 内存中的 timers（使用 setTimeout，支持绝对时间调度）
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

  // 加载所有 active triggers
  const triggers = await query<TriggerRow>('SELECT * FROM triggers WHERE active = true');

  for (const row of triggers) {
    const trigger = parseTriggerRow(row);
    await startTrigger(trigger);
  }

  console.log(`[TriggerEngine] Initialized with ${triggers.length} active triggers`);
}

/**
 * 启动单个 Trigger
 */
async function startTrigger(trigger: Trigger): Promise<void> {
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

/**
 * 计算 interval trigger 的下次触发时间
 */
function getNextIntervalFire(trigger: Trigger): Date {
  const intervalMs = (trigger.config.interval_ms as number) || 60_000;
  return new Date(Date.now() + intervalMs);
}

/**
 * 计算 cron trigger 的下次匹配时间（从 now 开始找）
 */
function getNextCronFire(cronExpr: string, from: Date = new Date()): Date | null {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length < 5) return null;

  const [minute, hour, dom, month, dow] = parts;

  // 从当前时间的下一秒开始搜索，最多搜 366 天
  const start = new Date(from.getTime() + 1000);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    const candidate = new Date(start.getTime() + i * 60 * 1000);
    if (matchesCron(candidate, parts)) {
      return candidate;
    }
  }
  return null;
}

/**
 * 持久化下次触发时间到 DB
 */
async function scheduleNext(trigger: Trigger): Promise<void> {
  let next: Date | null = null;

  if (trigger.type === 'interval') {
    next = getNextIntervalFire(trigger);
  } else if (trigger.type === 'cron') {
    const cronExpr = trigger.config.cron as string;
    if (cronExpr) {
      next = getNextCronFire(cronExpr, new Date());
    }
  } else {
    // webhook / condition 不需要调度
    return;
  }

  if (!next) return;

  // 持久化到 DB（供重启后补偿判断使用）
  await query(
    'UPDATE triggers SET last_fired_at = NOW(), next_fire_at = $1 WHERE id = $2',
    [next, trigger.id]
  );
  trigger.last_fired_at = new Date();
  trigger.next_fire_at = next;
}

function startIntervalTrigger(trigger: Trigger): void {
  const intervalMs = (trigger.config.interval_ms as number) || 60_000;

  const scheduleNextAndFire = async () => {
    // 计算并持久化下次触发时间
    const next = new Date(Date.now() + intervalMs);
    await query(
      'UPDATE triggers SET last_fired_at = NOW(), next_fire_at = $1 WHERE id = $2',
      [next, trigger.id]
    );
    trigger.last_fired_at = new Date();
    trigger.next_fire_at = next;

    // 实际触发
    await fireTrigger(trigger);

    // 调度下一次（interval 固定周期）
    scheduleInterval(trigger, intervalMs);
  };

  // 检查是否错过了触发（服务器停机期间）
  if (trigger.next_fire_at) {
    const now = Date.now();
    const nextMs = trigger.next_fire_at.getTime();
    if (nextMs <= now) {
      // 错过了，立即触发
      console.log(`[TriggerEngine] Interval trigger ${trigger.id} missed by ${now - nextMs}ms, firing now`);
      triggerTimers.set(trigger.id, { timeout: null, isRunning: true });
      scheduleNextAndFire().catch(e => {
        console.error(`[TriggerEngine] Error firing missed interval trigger:`, e);
        triggerTimers.delete(trigger.id);
      });
      return;
    } else {
      // 未错过，按 next_fire_at 调度
      const delay = nextMs - now;
      console.log(`[TriggerEngine] Interval trigger ${trigger.id} fires in ${delay}ms`);
      triggerTimers.set(trigger.id, { timeout: null, isRunning: true });
      scheduleInterval(trigger, delay);
      return;
    }
  }

  // 首次启动（无 next_fire_at），立即调度
  triggerTimers.set(trigger.id, { timeout: null, isRunning: true });
  scheduleInterval(trigger, intervalMs);
}

function scheduleInterval(trigger: Trigger, delayMs: number): void {
  // 先清除旧的 timer
  const existing = triggerTimers.get(trigger.id);
  if (existing?.timeout) {
    clearTimeout(existing.timeout);
  }

  const intervalMs = (trigger.config.interval_ms as number) || 60_000;

  const handle: TimerHandle = { timeout: null, isRunning: true };
  triggerTimers.set(trigger.id, handle);

  handle.timeout = setTimeout(async () => {
    if (!triggerTimers.get(trigger.id)?.isRunning) return;

    // 计算并持久化下次触发时间
    const next = new Date(Date.now() + intervalMs);
    await query(
      'UPDATE triggers SET last_fired_at = NOW(), next_fire_at = $1 WHERE id = $2',
      [next, trigger.id]
    );
    trigger.last_fired_at = new Date();
    trigger.next_fire_at = next;

    await fireTrigger(trigger);

    // 继续调度下一次
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

  // 检查是否错过了 cron 触发时间
  if (trigger.next_fire_at) {
    const now = Date.now();
    const nextMs = trigger.next_fire_at.getTime();
    if (nextMs <= now) {
      // 错过了，立即触发一次
      console.log(`[TriggerEngine] Cron trigger ${trigger.id} missed by ${now - nextMs}ms, firing now`);
      triggerTimers.set(trigger.id, { timeout: null, isRunning: true });
      const next = await scheduleNextCron();
      if (next) await fireTrigger(trigger);
      // 调度下一次
      scheduleCron(trigger, cronExpr);
      return;
    } else {
      // 未错过，按 next_fire_at 调度
      const delay = nextMs - now;
      console.log(`[TriggerEngine] Cron trigger ${trigger.id} fires in ${delay}ms`);
      triggerTimers.set(trigger.id, { timeout: null, isRunning: true });
      scheduleCronDelayed(trigger, cronExpr, delay);
      return;
    }
  }

  // 首次启动，调度下一次匹配
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
  if (existing?.timeout) {
    clearTimeout(existing.timeout);
  }

  const handle: TimerHandle = { timeout: null, isRunning: true };
  triggerTimers.set(trigger.id, handle);

  handle.timeout = setTimeout(async () => {
    if (!triggerTimers.get(trigger.id)?.isRunning) return;

    // 更新 last_fired_at 和 next_fire_at
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

    // 调度下一次 cron 匹配
    scheduleCron(trigger, cronExpr);
  }, delayMs);
}

function matchesCron(now: Date, parts: string[]): boolean {
  const [minute, hour, dom, month, dow] = parts;
  const m = now.getMinutes();
  const h = now.getHours();
  const d = now.getDate();
  const mo = now.getMonth() + 1; // getMonth() is 0-indexed
  const w = now.getDay(); // 0 = Sunday

  // 当月最后一天
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  // 当月最后一个工作日
  const getLastWeekdayOfMonth = (): number => {
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    while (last.getDay() === 0 || last.getDay() === 6) {
      last.setDate(last.getDate() - 1);
    }
    return last.getDate();
  };

  const matchField = (field: string, value: number, extra?: { lastDay?: number; lastWeekday?: number }): boolean => {
    if (field === '*') return true;
    if (field === '?') return true; // 无指定值（互斥字段）

    // L - 最后一天（仅 dom 字段）
    if (field === 'L') {
      return extra?.lastDay !== undefined && value === extra.lastDay;
    }
    // LW - 月最后一个工作日
    if (field === 'LW') {
      return extra?.lastWeekday !== undefined && value === extra.lastWeekday;
    }
    // nL - 每月最后一个第 n 天（dow 字段，如 1L=最后周日）
    if (field.endsWith('L') && /^\d+L$/.test(field)) {
      const targetDow = parseInt(field.slice(0, -1));
      // 找到本月最后一个 targetDow
      const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const lastOfTargetDow = lastOfMonth.getDay() - targetDow;
      const daysToSubtract = lastOfTargetDow >= 0 ? lastOfTargetDow : 7 + lastOfTargetDow;
      const lastTargetDate = lastOfMonth.getDate() - daysToSubtract;
      return value === lastTargetDate;
    }

    // W - 每月第 n 个工作日（简化：仅支持 1W-当月最后一个工作日范围）
    // 实际 W 修饰符比较复杂，这里支持 "nW" 格式表示 "每月第 n 个工作日"
    if (field.endsWith('W') && /^\d+W$/.test(field)) {
      // nW 的语义是"最近的工作日"，简化处理：仅支持 lastWeekday 场景
      return false; // 需要额外上下文，暂不支持精确匹配
    }

    // 标准语法
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
    (dom === '*' || matchField(dom, d, { lastDay: lastDayOfMonth, lastWeekday: getLastWeekdayOfMonth() })) &&
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
