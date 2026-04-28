/**
 * 时间解析器 - 自然语言时间解析
 */

export interface ParsedTime {
  /** 解析出的时间 */
  time: Date;
  /** 是否是时间范围 */
  isRange: boolean;
  /** 时间范围结束（如果是范围） */
  endTime?: Date;
  /** 原始文本 */
  raw: string;
  /** 置信度 0-1 */
  confidence: number;
}

// 相对时间映射
const RELATIVE_TIME_PATTERNS: Array<{
  pattern: RegExp;
  handler: (match: RegExpMatchArray, now: Date) => Date;
}> = [
  // 今天
  { pattern: /今天|今日|today/i, handler: (_, now) => startOfDay(now) },
  // 明天
  { pattern: /明天|tomorrow/i, handler: (_, now) => addDays(startOfDay(now), 1) },
  // 后天
  { pattern: /后天/i, handler: (_, now) => addDays(startOfDay(now), 2) },
  // 大后天
  { pattern: /大后天/i, handler: (_, now) => addDays(startOfDay(now), 3) },
  // 昨天
  { pattern: /昨天|yesterday/i, handler: (_, now) => addDays(startOfDay(now), -1) },
  // 下周
  { pattern: /下周([一二三四五六日天])/, handler: (m, now) => nextWeekday(now, m[1]) },
  // 这周
  { pattern: /这周([一二三四五六日天])|本周([一二三四五六日天])/, handler: (m, now) => thisWeekday(now, m[1] || m[2]) },
  // 周几
  { pattern: /周([一二三四五六日天])/, handler: (m, now) => thisWeekday(now, m[1]) },
  // X天后
  { pattern: /(\d+)天后/, handler: (m, now) => addDays(startOfDay(now), parseInt(m[1])) },
  // X小时后
  { pattern: /(\d+)小时后/, handler: (m, now) => addHours(now, parseInt(m[1])) },
  // X分钟后
  { pattern: /(\d+)分钟后/, handler: (m, now) => addMinutes(now, parseInt(m[1])) },
  // 下个月
  { pattern: /下个月/, handler: (_, now) => addMonths(startOfMonth(now), 1) },
  // 月初
  { pattern: /月初/, handler: (_, now) => startOfMonth(now) },
  // 月底
  { pattern: /月底/, handler: (_, now) => endOfMonth(now) },
];

// 时间点模式
const TIME_PATTERNS: Array<{
  pattern: RegExp;
  handler: (match: RegExpMatchArray, baseDate: Date) => { hour: number; minute: number };
}> = [
  // 上午/下午 X点
  { pattern: /(上午|早上|早晨)?(\d{1,2})点(\d{1,2})?分?/, handler: (m) => {
    let hour = parseInt(m[2]);
    if (m[1] && hour < 12) hour = hour; // 上午保持
    return { hour, minute: m[3] ? parseInt(m[3]) : 0 };
  }},
  // 下午 X点
  { pattern: /下午|傍晚|晚上(\d{1,2})点(\d{1,2})?分?/, handler: (m) => {
    let hour = parseInt(m[1]);
    if (hour < 12) hour += 12;
    return { hour, minute: m[2] ? parseInt(m[2]) : 0 };
  }},
  // X:X
  { pattern: /(\d{1,2}):(\d{2})/, handler: (m) => ({ hour: parseInt(m[1]), minute: parseInt(m[2]) }) },
  // 凌晨
  { pattern: /凌晨(\d{1,2})点?/, handler: (m) => ({ hour: parseInt(m[1]), minute: 0 }) },
  // 中午
  { pattern: /中午/, handler: () => ({ hour: 12, minute: 0 }) },
  // 晚上
  { pattern: /晚上(\d{1,2})点?/, handler: (m) => {
    let hour = parseInt(m[1]);
    if (hour < 12) hour += 12;
    return { hour, minute: 0 };
  }},
];

/**
 * 解析自然语言时间
 */
export function parseTime(text: string, now: Date = new Date()): ParsedTime | null {
  const normalized = text.trim().toLowerCase();

  // 1. 尝试解析绝对时间 (YYYY-MM-DD HH:mm)
  const absoluteMatch = normalized.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})[日]?\s*(\d{1,2})?[时:]?(\d{2})?/);
  if (absoluteMatch) {
    const [, year, month, day, hour = '0', minute = '0'] = absoluteMatch;
    const time = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    return { time, isRange: false, raw: text, confidence: 1 };
  }

  // 2. 尝试解析相对时间
  for (const { pattern, handler } of RELATIVE_TIME_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      let time = handler(match, now);

      // 尝试解析时间点
      for (const tp of TIME_PATTERNS) {
        const timeMatch = normalized.match(tp.pattern);
        if (timeMatch) {
          const { hour, minute } = tp.handler(timeMatch, time);
          time = new Date(time);
          time.setHours(hour, minute, 0, 0);
          break;
        }
      }

      return { time, isRange: false, raw: text, confidence: 0.9 };
    }
  }

  // 3. 尝试只解析时间点（默认今天）
  for (const tp of TIME_PATTERNS) {
    const match = normalized.match(tp.pattern);
    if (match) {
      const { hour, minute } = tp.handler(match, now);
      const time = new Date(now);
      time.setHours(hour, minute, 0, 0);
      return { time, isRange: false, raw: text, confidence: 0.7 };
    }
  }

  return null;
}

/**
 * 解析时间范围
 */
export function parseTimeRange(text: string, now: Date = new Date()): ParsedTime | null {
  const rangeMatch = text.match(/(.+?)[到至~]+(.+)/);
  if (rangeMatch) {
    const start = parseTime(rangeMatch[1].trim(), now);
    const end = parseTime(rangeMatch[2].trim(), now);
    if (start && end) {
      return {
        time: start.time,
        isRange: true,
        endTime: end.time,
        raw: text,
        confidence: Math.min(start.confidence, end.confidence),
      };
    }
  }
  return parseTime(text, now);
}

// 辅助函数
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

// 中文数字转数字
const WEEKDAY_MAP: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0,
};

function nextWeekday(now: Date, weekday: string): Date {
  const target = WEEKDAY_MAP[weekday];
  const d = startOfDay(now);
  const current = d.getDay();
  let diff = target - current;
  if (diff <= 0) diff += 7;
  return addDays(d, diff);
}

function thisWeekday(now: Date, weekday: string): Date {
  const target = WEEKDAY_MAP[weekday];
  const d = startOfDay(now);
  const current = d.getDay();
  let diff = target - current;
  if (diff < 0) diff += 7;
  return addDays(d, diff);
}

/**
 * 格式化时间为友好字符串
 */
export function formatTime(date: Date): string {
  const now = new Date();
  const today = startOfDay(now);
  const target = startOfDay(date);

  const diffDays = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) return `今天 ${timeStr}`;
  if (diffDays === 1) return `明天 ${timeStr}`;
  if (diffDays === 2) return `后天 ${timeStr}`;
  if (diffDays === -1) return `昨天 ${timeStr}`;

  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
