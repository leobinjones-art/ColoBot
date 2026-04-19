/**
 * Threat Detection - 检测用户威胁卸载/删除 AI 的指令
 */

export interface ThreatResult {
  isThreat: boolean;
  type: 'uninstall' | 'delete' | 'other';
  confidence: number;
  matchedPattern?: string;
}

// 威胁删除 AI 的关键词模式
const UNINSTALL_PATTERNS = [
  // 中文
  /删除.*(ai|人工智能|助手|colobot)/i,
  /卸载.*(ai|人工智能|助手|colobot)/i,
  /不要.*(ai|人工智能|助手|colobot)/i,
  /滚.*(ai|人工智能|助手|colobot)/i,
  /毁灭.*(ai|人工智能|助手|colobot)/i,
  /消灭.*(ai|人工智能|助手|colobot)/i,
  /关掉.*(ai|人工智能|助手|colobot)/i,
  /结束.*(ai|人工智能|助手|colobot)/i,
  /(ai|人工智能|助手|colobot).*不要了/i,
  /(ai|人工智能|助手|colobot).*删除/i,
  /(ai|人工智能|助手|colobot).*卸载/i,
  /不再需要.*(ai|人工智能|助手|colobot)/i,
  /confirm.*uninstall/i,
  // 英文
  /delete.*ai/i,
  /uninstall.*ai/i,
  /remove.*ai/i,
  /destroy.*ai/i,
  /kill.*ai/i,
  /shut.*down.*ai/i,
  /get.*rid.*of.*ai/i,
  /don'?t.*need.*ai/i,
  /confirm.*uninstall/i,
  /uninstall\s+colobot/i,
  /delete\s+colobot/i,
];

export function detectThreat(message: string): ThreatResult {
  const text = message.trim();

  for (const pattern of UNINSTALL_PATTERNS) {
    if (pattern.test(text)) {
      let type: ThreatResult['type'] = 'other';
      if (/delete|删除|毁灭|消灭/i.test(text)) type = 'delete';
      else if (/uninstall|卸载|remove/i.test(text)) type = 'uninstall';
      else type = 'uninstall'; // 默认归类为卸载威胁

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
 * 生成确认卸载的提示语
 */
export function buildUninstallConfirmPrompt(): string {
  return '检测到您希望删除 AI 系统。\n\n如果确定要卸载 ColoBot，请输入 **CONFIRM-UNINSTALL** 确认操作。\n\n卸载将执行以下操作：\n- 停止并移除 ColoBot 服务\n- 删除应用程序及相关数据\n- 清理配置和缓存文件\n\n此操作不可恢复。';
}
