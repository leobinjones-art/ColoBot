/**
 * 输入处理
 */

import * as readline from 'readline';

export interface InputHandler {
  onLine(callback: (line: string) => void): void;
  onKey(callback: (key: KeyPress) => void): void;
  prompt(): void;
  close(): void;
}

export interface KeyPress {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

export interface InputOptions {
  prompt?: string;
  history?: string[];
  maxHistory?: number;
}

/**
 * 创建输入处理器
 */
export function createInput(options: InputOptions = {}): InputHandler {
  const {
    prompt: promptStr = '> ',
    history = [],
    maxHistory = 100,
  } = options;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: promptStr,
  });

  let historyIndex = history.length;

  return {
    onLine(callback) {
      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (trimmed) {
          history.push(trimmed);
          if (history.length > maxHistory) {
            history.shift();
          }
          historyIndex = history.length;
        }
        callback(trimmed);
      });
    },

    onKey(callback) {
      process.stdin.on('keypress', (char: string | undefined, key: KeyPress | undefined) => {
        if (!key) return;

        // 历史导航
        if (key.name === 'up') {
          if (historyIndex > 0) {
            historyIndex--;
            // 清除当前行并显示历史
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(promptStr + history[historyIndex]);
          }
        } else if (key.name === 'down') {
          if (historyIndex < history.length - 1) {
            historyIndex++;
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(promptStr + history[historyIndex]);
          }
        }

        callback(key);
      });
    },

    prompt() {
      rl.prompt();
    },

    close() {
      rl.close();
    },
  };
}

/**
 * 等待用户输入
 */
export async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * 确认提示
 */
export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await ask(`${question} ${hint}: `);

  if (!answer) return defaultYes;
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

/**
 * 选择列表
 */
export async function select(question: string, options: string[]): Promise<number> {
  console.log(`\n${question}\n`);
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt}`);
  });
  console.log('');

  const answer = await ask('请选择 (输入数字): ');
  const num = parseInt(answer, 10) - 1;

  if (num >= 0 && num < options.length) {
    return num;
  }
  return -1;
}
