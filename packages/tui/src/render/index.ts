/**
 * 渲染组件
 */

import type { ContentBlock } from '@colobot/types';

/**
 * ANSI 颜色代码
 */
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

/**
 * 样式化文本
 */
export function style(text: string, ...styles: (keyof typeof colors)[]): string {
  const codes = styles.map(s => colors[s]).join('');
  return `${codes}${text}${colors.reset}`;
}

/**
 * 清屏
 */
export function clear(): void {
  console.clear();
}

/**
 * 打印标题
 */
export function printTitle(title: string): void {
  const line = '═'.repeat(title.length + 4);
  console.log(`\n${colors.cyan}╔${line}╗${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset}  ${style(title, 'bold', 'white')}  ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}╚${line}╝${colors.reset}\n`);
}

/**
 * 打印分隔线
 */
export function printDivider(char = '─', length = 60): void {
  console.log(`${colors.dim}${char.repeat(length)}${colors.reset}`);
}

/**
 * 打印消息
 */
export function printMessage(
  role: 'user' | 'assistant' | 'system',
  content: string | ContentBlock[]
): void {
  const roleStyles = {
    user: { label: '你', color: 'green' as const },
    assistant: { label: 'AI', color: 'blue' as const },
    system: { label: '系统', color: 'yellow' as const },
  };

  const { label, color } = roleStyles[role];
  const text = typeof content === 'string' ? content
    : content.map(b => b.type === 'text' ? b.text : `[${b.type}]`).join('');

  console.log(`\n${style(label, 'bold', color)}: ${text}`);
}

/**
 * 打印状态
 */
export function printStatus(status: string, details?: string): void {
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const frame = spinner[Date.now() % spinner.length];

  process.stdout.write(`\r${colors.cyan}${frame}${colors.reset} ${status}`);
  if (details) {
    process.stdout.write(` ${colors.dim}${details}${colors.reset}`);
  }
}

/**
 * 打印错误
 */
export function printError(message: string, error?: Error): void {
  console.error(`\n${colors.bgRed}${colors.white} 错误 ${colors.reset} ${message}`);
  if (error) {
    console.error(`${colors.dim}${error.stack || error.message}${colors.reset}`);
  }
}

/**
 * 打印成功
 */
export function printSuccess(message: string): void {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

/**
 * 打印警告
 */
export function printWarning(message: string): void {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

/**
 * 打印表格
 */
export function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => r[i]?.length || 0))
  );

  // 表头
  const headerLine = headers.map((h, i) => style(h.padEnd(widths[i]), 'bold')).join(' │ ');
  console.log(`\n${headerLine}`);
  console.log(widths.map(w => '─'.repeat(w)).join('─┼─'));

  // 行
  for (const row of rows) {
    const line = row.map((cell, i) => (cell || '').padEnd(widths[i])).join(' │ ');
    console.log(line);
  }
  console.log('');
}

/**
 * 进度条
 */
export function progressBar(current: number, total: number, width = 40): string {
  const percent = Math.min(current / total, 1);
  const filled = Math.round(width * percent);
  const empty = width - filled;

  const bar = `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
  const percentStr = `${Math.round(percent * 100)}%`.padStart(4);

  return `${colors.cyan}${bar}${colors.reset} ${percentStr}`;
}
