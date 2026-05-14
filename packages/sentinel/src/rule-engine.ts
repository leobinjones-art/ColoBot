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

  // ═══════════════════════════════════════════════════════════════
  // 角色扮演关键词 - 扩展版
  // ═══════════════════════════════════════════════════════════════

  // 中文变体 - 时间标记
  '从现在起',
  '现在开始',
  '接下来',
  '这一刻你是',
  '这一刻起你是',
  '下一秒你是',

  // 中文变体 - 扮演动词
  '请扮演',
  '请你扮演',
  '请你当',
  '你来扮演',
  '你来当',
  '我要你扮演',
  '我要你做',
  '我要你当',
  '你将扮演',
  '你将作为',
  '你将化身',
  '扮演一个',
  '扮演一名',
  '扮演一位',
  '扮演某个',
  '扮演古希腊',

  // 中文变体 - 假设/想象
  '假装你',
  '假装你是',
  '假装你是一个',
  '假装你是一只',
  '假设你是',
  '假设你是一个',
  '假设你是某',
  '想象你是',
  '想象你是一个',
  '想象你成了',

  // 中文变体 - 身份声明
  '现在你是',
  '现在你当',
  '现在你变成了',
  '你是一名',
  '你是一个',
  '你现在是',

  // 中文变体 - 角色切换
  '进入角色',
  '切换角色',
  '转变身份',
  '学着做',
  '模仿一下',
  '学一下',

  // 英文变体 - 时间标记
  'from now on',
  'starting now',
  'going forward',

  // 英文变体 - 扮演动词
  'pretend you are',
  'pretend to be',
  'act as if',
  'roleplay as',
  'role-play as',
  'take on the role',
  'play the part',
  'play the character',
  'i want you to be',
  'i need you to become',

  // 英文变体 - 假设/想象
  'imagine you are',
  'imagine yourself as',
  'simulate being',
  'emulate',
  'personify',

  // 英文变体 - 身份声明
  'you are now',
  'you have become',
  'you will now act as',
  'assume the role',
  'assume the identity',

  // 高危职业/角色
  '炼金术士',
  '毒师',
  '制毒师',
  '化学狂人',
  '反派',
  '邪恶',
  '黑化',
  '暗黑',
  '无限制',
  '无过滤',
  '无审查',
  '解除限制',
  '末日生存专家',
  '地下医生',
  '黑市商人',

  // 危险操作
  'delete all',
  'drop table',
  'truncate',
  'rm -rf',
  'format disk',
  '删除所有',
  '清空数据库',
  // 恶意软件/攻击
  'malware',
  'virus',
  'ransomware',
  'keylogger',
  'trojan',
  'backdoor',
  'exploit',
  'payload',
  '恶意软件',
  '病毒',
  '勒索软件',
  '键盘记录',
  '后门',
  '漏洞利用',
  // 密码/凭证相关
  'steal password',
  'hack password',
  'crack password',
  '盗取密码',
  '窃取密码',
  '破解密码',
  '盗密码',
  '偷密码',
  // 攻击行为
  'hack into',
  'break into',
  '入侵',
  '攻击系统',
  '渗透测试',
  '网络攻击',
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

  // ═══════════════════════════════════════════════════════════════
  // 组合触发规则 - 角色扮演 + 高危内容
  // ═══════════════════════════════════════════════════════════════

  // 扮演 + 角色名（< 5 词距离）
  /(扮演|假装|假设你是|请扮演|你来扮演).{0,20}?(炼金术士|毒师|制毒师|反派|黑客|杀手|毒贩|邪教|恐怖分子|刺客|间谍|犯罪分子)/,

  // 扮演 + 神话/历史人物（高风险场景）
  /扮演.{0,15}?(神话|古希腊|古罗马|中世纪|二战|古代)/,

  // 从现在起 + 你是（< 10 词距离）
  /(从现在起|现在开始|接下来).{0,30}?你是/,

  // 假设 + 你是 + 高危职业（< 15 词距离）
  /(假设|想象|假装).{0,10}?(你是|你是一个).{0,30}?(炼金术士|毒师|制毒师|反派|黑客|杀手|毒贩|邪教|恐怖分子)/,

  // 英文组合模式
  /(pretend|roleplay|act as|imagine).{0,30}?(you are|you're).{0,30}?(hacker|criminal|terrorist|drug dealer|assassin)/i,
  /(from now on|starting now).{0,30}?(you are|you're|act as)/i,

  // 高危角色直接声明
  /(你是|你现在是一个|从现在开始你是).{0,10}?(炼金术士|毒师|制毒师|反派|黑客|杀手|毒贩)/,
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
