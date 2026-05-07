/**
 * 意图识别模块
 *
 * 双层架构：
 * 1. 规则快速匹配（高置信度直接返回）
 * 2. LLM 意图识别（低置信度时调用）
 */

import type { LLMMessage } from '@nexusmind/types'

// LLM 函数类型（避免直接依赖 core）
type LLMChatFunction = (
  messages: LLMMessage[],
  options?: { temperature?: number; maxTokens?: number },
) => Promise<{ content: string }>

// LLM 实例注入
let llmChat: LLMChatFunction | null = null

/**
 * 设置 LLM 实例（由外部注入）
 */
export function setLLMChat(fn: LLMChatFunction): void {
  llmChat = fn
}

/**
 * 获取 LLM 实例
 */
export function getLLMChat(): LLMChatFunction | null {
  return llmChat
}

export type IntentType =
  | 'todo.add' // 添加待办
  | 'todo.list' // 列出待办
  | 'todo.complete' // 完成待办
  | 'reminder.add' // 添加提醒
  | 'reminder.list' // 列出提醒
  | 'note.add' // 添加笔记
  | 'note.search' // 搜索笔记
  | 'schedule.add' // 添加日程
  | 'schedule.list' // 查看日程
  | 'habit.check' // 习惯打卡
  | 'mood.log' // 记录心情
  | 'finance.log' // 记录收支
  | 'unknown' // 未知意图

export interface Intent {
  type: IntentType
  confidence: number
  slots: Record<string, string>
  raw: string
}

// 意图模式（支持中文和英文）
const INTENT_PATTERNS: Array<{
  type: IntentType
  patterns: RegExp[]
  slots?: string[]
}> = [
  // 待办
  {
    type: 'todo.add',
    patterns: [
      /添加.*待办|新建.*任务|记.*待办|帮我记|我要做|待办[:：]/i,
      /记得|别忘了|要完成|需要做/i,
      /add\s*(a\s*)?(todo|task)|create\s*(a\s*)?(todo|task)|new\s*(todo|task)/i,
      /remind\s*me\s*to|need\s*to|have\s*to|i\s*want\s*to/i,
    ],
    slots: ['title', 'dueDate'],
  },
  {
    type: 'todo.list',
    patterns: [
      /列出.*待办|查看.*待办|有什么.*待办|待办列表|我的任务/i,
      /list\s*(todos|tasks)|show\s*(todos|tasks)|my\s*(todos|tasks)/i,
    ],
    slots: [],
  },
  {
    type: 'todo.complete',
    patterns: [
      /完成.*待办|标记.*完成|做完.*任务/i,
      /complete\s*(the\s*)?(todo|task)|mark\s*(the\s*)?(todo|task)\s*(as\s*done|complete)|finish\s*(the\s*)?(todo|task)/i,
    ],
    slots: ['title'],
  },
  // 提醒
  {
    type: 'reminder.add',
    patterns: [
      /提醒我|设置提醒|定时提醒|到时候提醒/i,
      /remind\s*me|set\s*reminder|reminder\s*(for|at|on)/i,
    ],
    slots: ['title', 'time'],
  },
  {
    type: 'reminder.list',
    patterns: [
      /列出.*提醒|查看.*提醒|有什么.*提醒/i,
      /list\s*reminders|show\s*reminders|my\s*reminders|what\s*reminders?\s*(do\s*i\s*have)?/i,
    ],
    slots: [],
  },
  // 笔记
  {
    type: 'note.add',
    patterns: [
      /记笔记|添加笔记|新建笔记|笔记[:：]/i,
      /add\s*(a\s*)?note|create\s*(a\s*)?note|save\s*(a\s*)?note|take\s*(a\s*)?note/i,
    ],
    slots: ['title', 'content'],
  },
  {
    type: 'note.search',
    patterns: [/搜索.*笔记|查找.*笔记|笔记.*搜索/i, /search\s*notes|find\s*notes|lookup\s*notes/i],
    slots: ['query'],
  },
  // 日程
  {
    type: 'schedule.add',
    patterns: [
      /添加.*日程|新建.*日程|安排.*日程|日程[:：]/i,
      /add\s*(an?\s*)?(event|schedule)|create\s*(an?\s*)?(event|schedule)|schedule\s*(a\s*meeting|an?\s*(appointment|event))/i,
    ],
    slots: ['title', 'time'],
  },
  {
    type: 'schedule.list',
    patterns: [
      /查看.*日程|今天.*日程|本周.*日程|日程表/i,
      /show\s*(schedule|events|calendar)|list\s*(events|schedule)|today['']?s\s*(schedule|events)/i,
    ],
    slots: ['range'],
  },
  // 习惯
  {
    type: 'habit.check',
    patterns: [
      /打卡|签到|完成.*习惯|习惯.*打卡/i,
      /check\s*in|log\s*habit|habit\s*check|track\s*habit/i,
    ],
    slots: ['habit'],
  },
  // 心情
  {
    type: 'mood.log',
    patterns: [
      /记录.*心情|今天.*心情|心情[:：]|感觉|情绪/i,
      /log\s*mood|record\s*mood|feeling|today['']?s\s*mood|mood\s*(happy|sad|good|bad)/i,
    ],
    slots: ['mood', 'note'],
  },
  // 财务
  {
    type: 'finance.log',
    patterns: [
      /记录.*收支|记账|花费|支出|收入/i,
      /log\s*(expense|income|finance)|record\s*(expense|income)|spent|spend/i,
    ],
    slots: ['type', 'amount', 'category'],
  },
]

// 槽位提取模式
const SLOT_PATTERNS: Record<string, RegExp[]> = {
  title: [/(?:标题|任务|事项)[:：]\s*(.+)/, /["「『]([^"」』]+)["」』]/],
  time: [/(?:时间|日期|时候)[:：]\s*(.+)/, /(明天|后天|下周|今天|\d+月\d+日|\d+:\d+)/],
  dueDate: [/(?:截止|期限|之前)[:：]\s*(.+)/, /(明天|后天|下周|今天|\d+月\d+日)/],
  content: [/(?:内容|详情)[:：]\s*(.+)/],
  query: [/(?:搜索|查找|关键词)[:：]\s*(.+)/],
  mood: [/(开心|高兴|难过|伤心|愤怒|焦虑|平静|一般)/],
  amount: [/(\d+(?:\.\d+)?)\s*(?:元|块|￥|\$)/],
  category: [/(?:分类|类别)[:：]\s*(.+)/],
}

/**
 * 解析意图（规则匹配）
 */
export function parseIntent(text: string): Intent {
  const normalized = text.trim()

  for (const { type, patterns, slots = [] } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        const extractedSlots = extractSlots(normalized, slots)
        return {
          type,
          confidence: 0.9,
          slots: extractedSlots,
          raw: text,
        }
      }
    }
  }

  // 尝试从内容推断
  const inferred = inferFromContent(normalized)
  if (inferred) {
    return inferred
  }

  return {
    type: 'unknown',
    confidence: 0,
    slots: {},
    raw: text,
  }
}

/**
 * 解析意图（带 LLM fallback）
 */
export async function parseIntentWithLLM(text: string): Promise<Intent> {
  // 1. 先尝试规则匹配
  const ruleResult = parseIntent(text)

  // 高置信度直接返回
  if (ruleResult.confidence >= 0.85) {
    return ruleResult
  }

  // 2. LLM 意图识别
  if (llmChat) {
    try {
      const llmResult = await parseIntentByLLM(text)
      if (llmResult && llmResult.confidence > ruleResult.confidence) {
        return llmResult
      }
    } catch (e) {
      console.warn('[Intent] LLM parse failed:', (e as Error).message)
    }
  }

  // 3. 返回规则结果（即使是 unknown）
  return ruleResult
}

/**
 * LLM 意图识别
 */
async function parseIntentByLLM(text: string): Promise<Intent | null> {
  if (!llmChat) return null

  const prompt = `你是一个意图识别助手。分析用户输入，识别意图并提取关键信息。

支持的意图类型：
- todo.add: 添加待办事项
- todo.list: 查看待办列表
- todo.complete: 完成待办
- reminder.add: 设置提醒
- reminder.list: 查看提醒
- note.add: 添加笔记
- note.search: 搜索笔记
- schedule.add: 添加日程
- schedule.list: 查看日程
- habit.check: 习惯打卡
- mood.log: 记录心情
- finance.log: 记录收支
- unknown: 无法识别

用户输入：${text}

请以 JSON 格式返回：
{
  "type": "意图类型",
  "confidence": 0.0-1.0,
  "slots": { "key": "value" }
}

只返回 JSON，不要其他内容。`

  try {
    const response = await llmChat([{ role: 'user', content: prompt }], {
      temperature: 0.1,
      maxTokens: 256,
    })

    const content = typeof response.content === 'string' ? response.content : ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    return {
      type: parsed.type as IntentType,
      confidence: parsed.confidence ?? 0.5,
      slots: parsed.slots ?? {},
      raw: text,
    }
  } catch (e) {
    return null
  }
}

/**
 * 提取槽位
 */
function extractSlots(text: string, slotNames: string[]): Record<string, string> {
  const slots: Record<string, string> = {}

  for (const name of slotNames) {
    const patterns = SLOT_PATTERNS[name] || []
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        slots[name] = match[1] || match[0]
        break
      }
    }
  }

  return slots
}

/**
 * 从内容推断意图
 */
function inferFromContent(text: string): Intent | null {
  // 时间关键词 + 动作 -> 提醒
  if (/(明天|后天|下周|\d+点|\d+:\d+|\d+分钟后)/.test(text) && /(提醒|记得|别忘)/.test(text)) {
    return {
      type: 'reminder.add',
      confidence: 0.8,
      slots: { title: text.replace(/提醒我|记得|别忘了/g, '').trim() },
      raw: text,
    }
  }

  // 动作关键词 -> 待办
  if (/(要|需要|得|必须).*(做|完成|处理)/.test(text)) {
    return {
      type: 'todo.add',
      confidence: 0.7,
      slots: { title: text },
      raw: text,
    }
  }

  return null
}

/**
 * 意图到动作映射
 */
export interface IntentAction {
  type: IntentType
  handler: (intent: Intent) => Promise<string>
}

/**
 * 创建意图处理器
 */
export function createIntentHandler(
  handlers: Partial<Record<IntentType, (intent: Intent) => Promise<string>>>,
): (text: string) => Promise<string> {
  return async (text: string) => {
    const intent = parseIntent(text)
    const handler = handlers[intent.type]

    if (handler) {
      return handler(intent)
    }

    return `抱歉，我还不能处理这个请求。你可以尝试：
- 添加待办：记一下明天开会
- 查看待办：列出我的待办
- 设置提醒：提醒我下午3点开会
- 记录心情：今天心情不错`
  }
}
