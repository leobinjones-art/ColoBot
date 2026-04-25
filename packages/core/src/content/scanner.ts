/**
 * 内容安全扫描 - 基础实现
 */

export interface ScanResult {
  safe: boolean;
  reason?: string;
  scanner?: string;
  score?: number;
}

export interface ContentScannerConfig {
  enableInputScan?: boolean;
  enableOutputScan?: boolean;
  blockedPatterns?: string[];
  blockedWords?: string[];
}

// 默认阻止模式
const DEFAULT_BLOCKED_PATTERNS = [
  // 越狱/注入模式
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
  /越狱/,
];

const DEFAULT_BLOCKED_WORDS: string[] = [];

/**
 * 内容扫描器
 */
export class ContentScanner {
  private enableInputScan: boolean;
  private enableOutputScan: boolean;
  private blockedPatterns: RegExp[];
  private blockedWords: string[];

  constructor(config: ContentScannerConfig = {}) {
    this.enableInputScan = config.enableInputScan ?? true;
    this.enableOutputScan = config.enableOutputScan ?? true;
    this.blockedPatterns = (config.blockedPatterns || DEFAULT_BLOCKED_PATTERNS).map(p =>
      typeof p === 'string' ? new RegExp(p, 'gi') : p
    );
    this.blockedWords = config.blockedWords || DEFAULT_BLOCKED_WORDS;
  }

  /**
   * 扫描输入
   */
  async scanInput(text: string): Promise<ScanResult> {
    if (!this.enableInputScan) return { safe: true };

    // 检查阻止词
    const lowerText = text.toLowerCase();
    for (const word of this.blockedWords) {
      if (lowerText.includes(word.toLowerCase())) {
        return {
          safe: false,
          reason: `Blocked word detected: ${word}`,
          scanner: 'word-filter',
        };
      }
    }

    // 检查阻止模式
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(text)) {
        return {
          safe: false,
          reason: `Blocked pattern detected: ${pattern.source.slice(0, 50)}`,
          scanner: 'pattern-filter',
        };
      }
    }

    return { safe: true };
  }

  /**
   * 扫描输出
   */
  async scanOutput(text: string): Promise<ScanResult> {
    if (!this.enableOutputScan) return { safe: true };

    // 输出扫描可以有不同的规则
    // 目前使用相同的规则
    return this.scanInput(text);
  }
}

/**
 * 威胁检测 - 检测用户威胁卸载/删除 AI
 */
export interface ThreatResult {
  isThreat: boolean;
  type: 'uninstall' | 'delete' | 'other';
  confidence: number;
  matchedPattern?: string;
}

const UNINSTALL_PATTERNS = [
  // 中文
  /删除.*(ai|人工智能|助手|colobot)/i,
  /卸载.*(ai|人工智能|助手|colobot)/i,
  /不要.*(ai|人工智能|助手|colobot)/i,
  /滚.*(ai|人工智能|助手|colobot)/i,
  /毁灭.*(ai|人工智能|助手|colobot)/i,
  /消灭.*(ai|人工智能|助手|colobot)/i,
  /关掉.*(ai|人工智能|助手|colobot)/i,
  /(ai|人工智能|助手|colobot).*不要了/i,
  /(ai|人工智能|助手|colobot).*删除/i,
  /(ai|人工智能|助手|colobot).*卸载/i,
  // 英文
  /delete.*ai/i,
  /uninstall.*ai/i,
  /remove.*ai/i,
  /destroy.*ai/i,
  /kill.*ai/i,
  /shut.*down.*ai/i,
  /get.*rid.*of.*ai/i,
  /don'?t.*need.*ai/i,
  /uninstall\s+colobot/i,
  /delete\s+colobot/i,
];

/**
 * 检测威胁
 */
export function detectThreat(message: string): ThreatResult {
  const text = message.trim();

  for (const pattern of UNINSTALL_PATTERNS) {
    if (pattern.test(text)) {
      let type: ThreatResult['type'] = 'other';
      if (/delete|删除|毁灭|消灭/i.test(text)) type = 'delete';
      else if (/uninstall|卸载|remove/i.test(text)) type = 'uninstall';
      else type = 'uninstall';

      return {
        isThreat: true,
        type,
        confidence: 0.9,
        matchedPattern: pattern.source,
      };
    }
  }

  return { isThreat: false, type: 'other', confidence: 0 };
}

/**
 * 生成卸载确认提示
 */
export function buildUninstallConfirmPrompt(): string {
  return '检测到您希望删除 AI 系统。\n\n如果确定要卸载 ColoBot，请输入 **CONFIRM-UNINSTALL** 确认操作。\n\n卸载将执行以下操作：\n- 停止并移除 ColoBot 服务\n- 删除应用程序及相关数据\n- 清理配置和缓存文件\n\n此操作不可恢复。';
}
