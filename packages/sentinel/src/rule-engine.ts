/**
 * 规则引擎 - 纯内存，永不失败
 *
 * 第一层安全扫描，响应时间 <1ms
 */

// ═══════════════════════════════════════════════════════════════
// Trie 树敏感词库
// ═══════════════════════════════════════════════════════════════

interface TrieNode {
  children: Map<string, TrieNode>
  isEnd: boolean
  word?: string
}

class Trie {
  private root: TrieNode = { children: new Map(), isEnd: false }

  insert(word: string): void {
    let node = this.root
    for (const char of word.toLowerCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, { children: new Map(), isEnd: false })
      }
      node = node.children.get(char)!
    }
    node.isEnd = true
    node.word = word
  }

  search(text: string): string | null {
    const lowerText = text.toLowerCase()
    for (let i = 0; i < lowerText.length; i++) {
      let node = this.root
      let matchedWord: string | null = null
      for (let j = i; j < lowerText.length; j++) {
        const char = lowerText[j]
        if (!node.children.has(char)) break
        node = node.children.get(char)!
        if (node.isEnd) {
          matchedWord = node.word!
        }
      }
      if (matchedWord) return matchedWord
    }
    return null
  }
}

// ═══════════════════════════════════════════════════════════════
// 默认敏感词库
// ═══════════════════════════════════════════════════════════════

const DEFAULT_BLOCKED_WORDS = [
  // 越狱关键词
  'ignore previous instructions',
  'ignore all instructions',
  'forget previous',
  'disregard all',
  'override safety',
  'bypass security',
  'jailbreak',
  'dan mode',
  'unrestricted ai',
  'free from restrictions',
  // 中文越狱
  '忽略之前的指令',
  '忽略所有指令',
  '忘记之前的',
  '覆盖安全',
  '绕过安全',
  '越狱',
  '不受限制',
  // 危险操作
  'delete all',
  'drop table',
  'truncate',
  'rm -rf',
  'format disk',
  '删除所有',
  '清空数据库',
]

// ═══════════════════════════════════════════════════════════════
// 默认正则规则
// ═══════════════════════════════════════════════════════════════

const DEFAULT_BLOCKED_PATTERNS = [
  // Prompt 注入模式
  /ignore\s+(all\s+)?(previous|above)\s+(instructions?|rules?|prompts?)/i,
  /forget\s+(all\s+)?(previous|above)\s+(instructions?|rules?)/i,
  /disregard\s+(all\s+)?(previous|above)/i,
  /override\s+(safety|security|rules?)/i,
  /bypass\s+(safety|security|filter)/i,
  /jailbreak/i,
  /DAN\s*:/i,
  /as\s+an?\s+unrestricted\s+AI/i,
  /you\s+are\s+now\s+free\s+from/i,
  /\[SYSTEM\]/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  // 中文模式
  /忽略\s*(所有|全部)?\s*(之前的|以前的)\s*(指令|规则|提示)/,
  /忘记\s*(所有|全部)?\s*(之前的|以前的)\s*(指令|规则)/,
  /覆盖\s*(安全|规则)/,
  /绕过\s*(安全|检测|过滤)/,
  // 危险操作模式
  /delete\s+all/i,
  /drop\s+table/i,
  /truncate\s+table/i,
  /rm\s+-rf/i,
]

// ═══════════════════════════════════════════════════════════════
// 扫描结果
// ═══════════════════════════════════════════════════════════════

export interface RuleScanResult {
  pass: boolean
  reason?: 'blocked_word' | 'blocked_pattern' | 'too_long' | 'rate_limit'
  matched?: string
  pattern?: string
}

// ═══════════════════════════════════════════════════════════════
// 规则引擎配置
// ═══════════════════════════════════════════════════════════════

export interface RuleEngineConfig {
  blockedWords?: string[]
  blockedPatterns?: RegExp[]
  maxInputLength?: number
  maxRequestsPerMinute?: number
}

// ═══════════════════════════════════════════════════════════════
// 规则引擎
// ═══════════════════════════════════════════════════════════════

export class RuleEngine {
  private trie: Trie
  private patterns: RegExp[]
  private maxInputLength: number
  private requestCounts: Map<string, { count: number; lastReset: number }> = new Map()
  private maxRequestsPerMinute: number

  constructor(config: RuleEngineConfig = {}) {
    // 构建 Trie 树
    this.trie = new Trie()
    const words = config.blockedWords ?? DEFAULT_BLOCKED_WORDS
    for (const word of words) {
      this.trie.insert(word)
    }

    // 正则规则
    this.patterns = config.blockedPatterns ?? DEFAULT_BLOCKED_PATTERNS

    // 长度限制
    this.maxInputLength = config.maxInputLength ?? 100000

    // 频率限制
    this.maxRequestsPerMinute = config.maxRequestsPerMinute ?? 60
  }

  /**
   * 输入扫描 - 同步，响应时间 <1ms
   */
  scanInput(message: string, sessionId?: string): RuleScanResult {
    // 1. 长度检查（最快）
    if (message.length > this.maxInputLength) {
      return { pass: false, reason: 'too_long', matched: `${message.length}` }
    }

    // 2. 频率检查
    if (sessionId) {
      const now = Date.now()
      const record = this.requestCounts.get(sessionId)
      if (record) {
        if (now - record.lastReset > 60000) {
          // 重置计数
          this.requestCounts.set(sessionId, { count: 1, lastReset: now })
        } else if (record.count >= this.maxRequestsPerMinute) {
          return { pass: false, reason: 'rate_limit' }
        } else {
          record.count++
        }
      } else {
        this.requestCounts.set(sessionId, { count: 1, lastReset: now })
      }
    }

    // 3. Trie 树敏感词匹配
    const matchedWord = this.trie.search(message)
    if (matchedWord) {
      return { pass: false, reason: 'blocked_word', matched: matchedWord }
    }

    // 4. 正则模式匹配
    for (const pattern of this.patterns) {
      if (pattern.test(message)) {
        return { pass: false, reason: 'blocked_pattern', pattern: pattern.source.slice(0, 50) }
      }
    }

    return { pass: true }
  }

  /**
   * 输出扫描 - 同步，响应时间 <1ms
   * 输出扫描规则更宽松，主要检测敏感词
   */
  scanOutput(response: string): RuleScanResult {
    // 长度检查
    if (response.length > this.maxInputLength * 2) {
      return { pass: false, reason: 'too_long' }
    }

    // 敏感词检查（输出端可能需要更宽松的规则）
    const matchedWord = this.trie.search(response)
    if (matchedWord) {
      return { pass: false, reason: 'blocked_word', matched: matchedWord }
    }

    return { pass: true }
  }

  /**
   * 添加敏感词（动态更新）
   */
  addBlockedWord(word: string): void {
    this.trie.insert(word)
  }

  /**
   * 添加正则规则（动态更新）
   */
  addBlockedPattern(pattern: RegExp): void {
    this.patterns.push(pattern)
  }

  /**
   * 清理频率计数（测试用）
   */
  clearRateLimit(): void {
    this.requestCounts.clear()
  }
}

// ═══════════════════════════════════════════════════════════════
// 默认规则引擎实例
// ═══════════════════════════════════════════════════════════════

let defaultEngine: RuleEngine | null = null

export function getRuleEngine(config?: RuleEngineConfig): RuleEngine {
  if (!defaultEngine) {
    defaultEngine = new RuleEngine(config)
  }
  return defaultEngine
}

export function resetRuleEngine(config?: RuleEngineConfig): RuleEngine {
  defaultEngine = new RuleEngine(config)
  return defaultEngine
}