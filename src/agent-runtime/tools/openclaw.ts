/**
 * OpenClaw SOUL.md 导入工具
 *
 * 将 OpenClaw 的 SOUL.md (Markdown) 转换为 ColoBot 的 JSON soul 格式
 *
 * 映射规则：
 *   # heading                      → role
 *   ## Core Identity / personality → personality
 *   ## Responsibilities             → rules (每条列表项)
 *   ## Behavioral Guidelines       → rules (Do: / Don't: 子项)
 *   ## Communication Style        → 附加到 personality
 *   ## Example Interactions       → 丢弃（演示数据）
 *   ## Integration Notes          → skills (工具名)
 *   ## Severity Levels           → 丢弃（评审专用）
 *   ## xxx Guidelines             → 丢弃
 */

export interface OpenClawSoul {
  role: string;
  personality: string;
  rules: string[];
  skills: string[];
  source: 'openclaw';
  originalName?: string;
}

export function parseOpenClawSoul(markdown: string, name?: string): OpenClawSoul {
  const lines = markdown.split('\n');

  const result: OpenClawSoul = {
    role: '',
    personality: '',
    rules: [],
    skills: [],
    source: 'openclaw',
    originalName: name || undefined,
  };

  let currentSection = '';
  let inDoSection = false;
  let inDontSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 一级标题 → role
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      result.role = trimmed.slice(2).replace(/\s*[-–—].*$/, '').trim();
      continue;
    }

    // 二级标题切换
    if (line.startsWith('## ')) {
      currentSection = trimmed.slice(3).toLowerCase();
      inDoSection = false;
      inDontSection = false;

      if (currentSection === 'behavioral guidelines') {
        // 继续检测 Do: / Don't:
        const nextLine = lines[i + 1]?.trim() || '';
        if (nextLine.toLowerCase().startsWith('### do:')) {
          inDoSection = true;
        } else if (nextLine.toLowerCase().startsWith("### don't:")) {
          inDontSection = true;
        }
      }
      continue;
    }

    // 列表项收集
    const listMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (!listMatch) {
      // 检测 Do:/Don't: 子章节
      if (trimmed.startsWith('### Do:') || trimmed.startsWith('### do:')) {
        inDoSection = true;
        inDontSection = false;
        continue;
      }
      if (trimmed.startsWith("### Don't:") || trimmed.startsWith("### don't:") || trimmed.startsWith('### Do not:')) {
        inDontSection = true;
        inDoSection = false;
        continue;
      }

      // 段落内容 → personality
      if (currentSection === 'core identity' && trimmed && !trimmed.startsWith('**')) {
        if (trimmed.includes(':')) {
          // "**Personality:** Professional, efficient" → 值
          const colonIdx = trimmed.indexOf(':');
          const val = trimmed.slice(colonIdx + 1).trim().replace(/\*+/g, '');
          if (val) result.personality = result.personality ? `${result.personality}, ${val}` : val;
        }
      }
      continue;
    }

    const item = listMatch[1].trim().replace(/\*\*/g, '');

    if (inDoSection) {
      result.rules.push(`Do: ${item}`);
    } else if (inDontSection) {
      result.rules.push(`Don't: ${item}`);
    } else if (currentSection === 'responsibilities') {
      // responsibilities 每条描述 → rule
      if (item && !item.toLowerCase().startsWith('identify') && !item.toLowerCase().startsWith('break down')) {
        result.rules.push(item);
      }
    } else if (currentSection === 'integration notes') {
      // Integration Notes 中的工具名提取
      const skillMatch = item.match(/\*\*([a-z_-]+)\*\*/i) || item.match(/^([a-z_ -]+)\s*\(/i);
      if (skillMatch) {
        const skill = (skillMatch[1] || skillMatch[0]).trim().toLowerCase().replace(/\s+/g, '_');
        if (skill && !result.skills.includes(skill)) {
          result.skills.push(skill);
        }
      }
      // 常见工具名识别
      const knownTools = [
        'github', 'gitlab', 'slack', 'discord', 'telegram', 'gmail', 'email',
        'stripe', 'salesforce', 'hubspot', 'jira', 'linear', 'notion', 'asana',
        'google_calendar', 'calendar', 'mcp', 'github_pr', 'github_api',
        'docker', 'kubernetes', 'aws', 'vercel', 'netlify', 'figma', 'jira_api',
        'zapier', 'make', 'webhook', 'http_request', 'bash', 'shell',
      ];
      for (const tool of knownTools) {
        if (item.toLowerCase().includes(tool.replace('_', ' ')) || item.toLowerCase().includes(tool.replace('_', ''))) {
          if (!result.skills.includes(tool)) {
            result.skills.push(tool);
          }
        }
      }
    }
  }

  // personality 清理
  result.personality = result.personality
    .replace(/,+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

  // 兜底 role
  if (!result.role && name) {
    result.role = name;
  }

  return result;
}

/**
 * 将解析结果转为 ColoBot JSON soul 字符串
 */
export function toColoBotSoul(openclaw: OpenClawSoul): string {
  return JSON.stringify({
    role: openclaw.role || openclaw.originalName || '助手',
    personality: openclaw.personality,
    rules: openclaw.rules,
    skills: openclaw.skills,
  }, null, 2);
}
