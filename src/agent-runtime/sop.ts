/**
 * SOP 状态机 - 管理学术 SOP 流程
 */

import { query, queryOne } from '../memory/db.js';
import { addMemory, listMemory } from '../memory/vector.js';
import { getSop, type SopDefinition, type SopStep } from '../content-policy/sops.js';
import type { AcademicCategory } from '../content-policy/rules.js';

const SOP_STATE_KEY_PREFIX = 'sop_state';

export interface StepRecord {
  step: number;
  name: string;
  content: string;
  completed_at: string;
}

export interface SopState {
  category: AcademicCategory;
  sessionKey: string;
  currentStep: number;
  steps: StepRecord[];
  startedAt: string;
}

function sopStateKey(sessionKey: string): string {
  return `${SOP_STATE_KEY_PREFIX}:${sessionKey}`;
}

function sopStepKey(sessionKey: string, step: number): string {
  return `sop_step:${sessionKey}:${step}`;
}

/**
 * 初始化 SOP
 */
export async function initSop(
  agentId: string,
  sessionKey: string,
  category: AcademicCategory
): Promise<SopState> {
  const sop = getSop(category);
  const state: SopState = {
    category,
    sessionKey,
    currentStep: 1,
    steps: [],
    startedAt: new Date().toISOString(),
  };
  const key = sopStateKey(sessionKey);
  await addMemory(agentId, key, JSON.stringify(state), {
    type: 'sop_state',
    category,
  });

  return state;
}

/**
 * 获取当前 SOP 状态
 */
export async function getSopState(
  agentId: string,
  sessionKey: string
): Promise<SopState | null> {
  const rows = await queryOne<{ memory_value: string }>(
    `SELECT memory_value FROM agent_memory
     WHERE agent_id = $1 AND memory_key = $2
     ORDER BY created_at DESC LIMIT 1`,
    [agentId, sopStateKey(sessionKey)]
  );

  if (!rows) return null;
  try {
    return JSON.parse(rows.memory_value) as SopState;
  } catch {
    return null;
  }
}

/**
 * 获取 SOP 当前步骤的引导文本
 */
export async function getCurrentStepPrompt(
  agentId: string,
  sessionKey: string
): Promise<string | null> {
  const state = await getSopState(agentId, sessionKey);
  if (!state) return null;

  const sop = getSop(state.category);
  const stepInfo = sop.steps.find(s => s.step === state.currentStep);
  return stepInfo?.prompt ?? null;
}

/**
 * 完成当前步骤，保存内容并前进到下一步
 */
export async function completeStep(
  agentId: string,
  sessionKey: string,
  content: string
): Promise<{ state: SopState; isComplete: boolean }> {
  const state = await getSopState(agentId, sessionKey);
  if (!state) throw new Error('SOP state not found');

  const sop = getSop(state.category);
  const stepInfo = sop.steps.find(s => s.step === state.currentStep);
  if (!stepInfo) throw new Error('Step not found');

  const record: StepRecord = {
    step: state.currentStep,
    name: stepInfo.name,
    content,
    completed_at: new Date().toISOString(),
  };

  state.steps.push(record);

  const isComplete = state.currentStep >= sop.steps.length;

  if (!isComplete) {
    state.currentStep += 1;
  }

  // 更新状态
  await addMemory(agentId, sopStateKey(sessionKey), JSON.stringify(state), {
    type: 'sop_state',
    category: state.category,
  });

  // 保存步骤内容到独立记忆
  await addMemory(agentId, sopStepKey(sessionKey, record.step), JSON.stringify(record), {
    type: 'sop_step',
    step: record.step,
    category: state.category,
  });

  return { state, isComplete };
}

/**
 * 获取 SOP 进度
 */
export async function getSopProgress(
  agentId: string,
  sessionKey: string
): Promise<{ progress: string; steps: StepRecord[]; currentStepName: string | null } | null> {
  const state = await getSopState(agentId, sessionKey);
  if (!state) return null;

  const sop = getSop(state.category);
  const totalSteps = sop.steps.length;
  const currentStepInfo = sop.steps.find(s => s.step === state.currentStep);

  return {
    progress: `${state.currentStep}/${totalSteps}`,
    steps: state.steps,
    currentStepName: currentStepInfo?.name ?? null,
  };
}

/**
 * 获取 SOP 欢迎语
 */
export async function getSopWelcome(agentId: string, sessionKey: string): Promise<string | null> {
  const state = await getSopState(agentId, sessionKey);
  if (!state) return null;

  const sop = getSop(state.category);
  return sop.welcome;
}

/**
 * 获取 SOP 完成文本
 */
export async function getSopCompletion(agentId: string, sessionKey: string): Promise<string | null> {
  const state = await getSopState(agentId, sessionKey);
  if (!state) return null;

  const sop = getSop(state.category);
  return sop.completion;
}

/**
 * 生成论文/综述/报告草稿（基于已有步骤数据）
 */
export async function generateDraft(
  agentId: string,
  sessionKey: string,
  llmGenerate: (prompt: string) => Promise<string>
): Promise<string> {
  const state = await getSopState(agentId, sessionKey);
  if (!state) throw new Error('SOP state not found');

  const sop = getSop(state.category);

  // 汇总各步骤内容
  const stepsSummary = state.steps.map(s =>
    `【${s.name}】\n${s.content}`
  ).join('\n\n');

  const prompt = `你是学术论文写作助手。基于以下 SOP 步骤收集的内容，生成完整的${sop.name}。

=== 已收集的内容 ===
${stepsSummary}

=== 要求 ===
1. 按照学术论文的规范格式组织内容
2. 语言正式、专业
3. 各章节之间逻辑连贯
4. 仅输出论文内容，不要包含说明性文字

请生成完整的${sop.name}：`;

  return llmGenerate(prompt);
}

/**
 * 取消 SOP
 */
export async function cancelSop(agentId: string, sessionKey: string): Promise<void> {
  await query(
    `DELETE FROM agent_memory
     WHERE agent_id = $1 AND memory_key LIKE $2`,
    [agentId, `${SOP_STATE_KEY_PREFIX}:${sessionKey}%`]
  );
}

/**
 * 检查是否需要继续 SOP（用户在普通对话中说了继续相关的话）
 */
export async function checkContinueSop(
  agentId: string,
  sessionKey: string,
  message: string
): Promise<boolean> {
  const continuePatterns = [
    /继续(写论文|论文|综述|报告)/i,
    /回到?sop/i,
    /继续sop/i,
    /继续(我的)?学术/i,
  ];

  const shouldContinue = continuePatterns.some(p => p.test(message));
  if (!shouldContinue) return false;

  const state = await getSopState(agentId, sessionKey);
  return state !== null;
}
