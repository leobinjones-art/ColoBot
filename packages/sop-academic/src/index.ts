/**
 * SOP 学术研究流程 - 主入口
 */

import type { ColoBotRuntime } from '@colobot/core';
import type { SopState, TaskAnalysis, SopResult, SopConfig } from './types.js';
import { SopEngine } from './engine.js';

// 导出类型
export * from './types.js';
export { SopEngine } from './engine.js';

/**
 * 创建 SOP 引擎
 */
export function createSopEngine(runtime: ColoBotRuntime, config?: Partial<SopConfig>): SopEngine {
  return new SopEngine(runtime, config);
}

/**
 * 检测是否为学术研究意图
 */
export function isAcademicIntent(message: string): boolean {
  const patterns = [
    /研究/i, /论文/i, /学术/i, /科研/i,
    /毕业/i, /课题/i, /实验/i, /调研/i,
    /文献/i, /写作/i, /分析/i,
    /research/i, /paper/i, /thesis/i,
  ];
  return patterns.some(p => p.test(message));
}

/**
 * 检测流程控制指令
 */
export function detectSopCommand(message: string): {
  type: 'exit' | 'pause' | 'resume' | 'confirm' | 'list' | 'restart' | 'none';
  stepNumber?: number;
} {
  const msg = message.trim().toLowerCase();

  if (/退出sop|取消任务|exit sop/i.test(msg)) return { type: 'exit' };
  if (/暂停sop|暂停$/i.test(msg)) return { type: 'pause' };
  if (/继续sop|恢复sop|继续$/i.test(msg)) return { type: 'resume' };
  if (/确认|是的|ok/i.test(msg)) return { type: 'confirm' };
  if (/sop列表|我的sop/i.test(msg)) return { type: 'list' };

  const restartMatch = msg.match(/重启步骤\s*(\d+)/i);
  if (restartMatch) {
    return { type: 'restart', stepNumber: parseInt(restartMatch[1], 10) };
  }

  return { type: 'none' };
}

/**
 * 格式化任务拆解
 */
export function formatTaskBreakdown(state: SopState): string {
  const lines = [
    `📋 **任务拆解**\n`,
    `**任务：** ${state.taskName}\n`,
    '**步骤：**',
  ];

  for (const step of state.steps) {
    lines.push(`${step.step}. **${step.name}**`);
    if (step.description) {
      lines.push(`   ${step.description}`);
    }
  }

  lines.push('');
  lines.push('回复"确认"开始执行，或提出修改意见。');

  return lines.join('\n');
}

/**
 * 格式化状态
 */
export function formatSopStatus(state: SopState): string {
  const doneCount = state.steps.filter(s => s.status === 'done').length;
  const progress = Math.round((doneCount / state.steps.length) * 100);

  const lines = [
    `📋 **${state.taskName}**`,
    `进度：${doneCount}/${state.steps.length} (${progress}%)\n`,
    '**步骤：**',
  ];

  for (const step of state.steps) {
    const icon = step.status === 'done' ? '✅' :
                 step.status === 'in_progress' ? '🔄' : '⏳';
    const current = step.step === state.currentStep ? ' (当前)' : '';
    lines.push(`${icon} ${step.step}. ${step.name}${current}`);
  }

  return lines.join('\n');
}
