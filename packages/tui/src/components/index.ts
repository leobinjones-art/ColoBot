/**
 * TUI 组件
 */

import { style, colors, printDivider } from '../render/index.js';

/**
 * 聊天界面组件
 */
export class ChatUI {
  private lines: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

  constructor(private title: string = 'ColoBot Chat') {}

  /**
   * 添加消息
   */
  addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    this.lines.push({ role, content });
    this.renderMessage(role, content);
  }

  /**
   * 渲染单条消息
   */
  private renderMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    const roleStyles = {
      user: { label: '你', color: 'green' as const },
      assistant: { label: 'AI', color: 'cyan' as const },
      system: { label: '系统', color: 'yellow' as const },
    };

    const { label, color } = roleStyles[role];
    console.log(`\n${style(label, 'bold', color)}: ${content}`);
  }

  /**
   * 显示正在输入
   */
  showTyping(): void {
    process.stdout.write(`\r${colors.dim}AI 正在输入...${colors.reset}`);
  }

  /**
   * 隐藏正在输入
   */
  hideTyping(): void {
    process.stdout.write('\r\x1b[K');
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.lines = [];
    console.clear();
  }
}

/**
 * 命令面板组件
 */
export class CommandPalette {
  private commands: Map<string, { description: string; handler: () => void }> = new Map();

  /**
   * 注册命令
   */
  register(name: string, description: string, handler: () => void): void {
    this.commands.set(name, { description, handler });
  }

  /**
   * 执行命令
   */
  execute(name: string): boolean {
    const cmd = this.commands.get(name);
    if (cmd) {
      cmd.handler();
      return true;
    }
    return false;
  }

  /**
   * 显示帮助
   */
  showHelp(): void {
    console.log('\n可用命令:\n');
    for (const [name, { description }] of this.commands) {
      console.log(`  ${style(name.padEnd(15), 'cyan')} ${description}`);
    }
    console.log('');
  }

  /**
   * 获取命令列表
   */
  list(): string[] {
    return Array.from(this.commands.keys());
  }
}

/**
 * 状态栏组件
 */
export class StatusBar {
  private status: string = '';
  private details: string = '';

  /**
   * 更新状态
   */
  update(status: string, details?: string): void {
    this.status = status;
    this.details = details || '';
    this.render();
  }

  /**
   * 渲染状态栏
   */
  private render(): void {
    const statusText = `${style('●', 'green')} ${this.status}`;
    const detailsText = this.details ? ` ${colors.dim}${this.details}${colors.reset}` : '';

    // 保存光标位置，移动到最后一行，渲染状态栏，恢复光标位置
    process.stdout.write('\x1b[s'); // 保存
    process.stdout.write('\x1b[999;0H'); // 移动到底部
    process.stdout.write('\x1b[K'); // 清除行
    process.stdout.write(`${statusText}${detailsText}`);
    process.stdout.write('\x1b[u'); // 恢复
  }

  /**
   * 清除状态栏
   */
  clear(): void {
    process.stdout.write('\x1b[s');
    process.stdout.write('\x1b[999;0H');
    process.stdout.write('\x1b[K');
    process.stdout.write('\x1b[u');
  }
}

/**
 * 日志面板组件
 */
export class LogPanel {
  private logs: Array<{ level: string; message: string; time: Date }> = [];
  private maxLogs = 100;

  /**
   * 添加日志
   */
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string): void {
    this.logs.push({ level, message, time: new Date() });
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    this.renderLog(level, message);
  }

  /**
   * 渲染日志
   */
  private renderLog(level: string, message: string): void {
    const levelColors = {
      info: 'blue',
      warn: 'yellow',
      error: 'red',
      debug: 'dim',
    };

    const color = levelColors[level as keyof typeof levelColors] || 'white';
    const time = new Date().toLocaleTimeString();

    console.log(`${colors.dim}[${time}]${colors.reset} ${style(level.toUpperCase().padEnd(5), color as any)} ${message}`);
  }

  /**
   * 获取所有日志
   */
  getLogs(): Array<{ level: string; message: string; time: Date }> {
    return [...this.logs];
  }
}
