/**
 * SOP 状态机 - AI 驱动的动态流程控制
 *
 * 核心设计：
 * - 父 Agent：任务拆解、引导、审核、流程控制
 * - 子 Agent：处理数据、生成内容（每步创建/销毁）
 * - 用户：执行工作、提交数据、确认
 */

import { query, queryOne } from '../memory/db.js';
import { addMemory, searchMemory } from '../memory/vector.js';
import { chat } from '../llm/index.js';
import { spawnSubAgent, runSubAgentTask, destroySubAgent, getSubAgent } from './sub-agents.js';

// ─── 类型定义 ───────────────────────────────────────────────────

export interface SopStep {
  step: number;
  name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked';
  userData: string | null;           // 用户提交的数据
  subAgentResult: string | null;     // 子 Agent 生成的内容
  approved: boolean;
  reviewNote: string | null;         // 审核意见
  subAgentId: string | null;         // 当前步骤的子 Agent ID
}

export interface SopState {
  taskId: string;
  sessionKey: string;
  agentId: string;
  taskName: string;
  taskSummary: string;               // 任务摘要
  steps: SopStep[];
  currentStep: number;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface TaskAnalysis {
  isAcademicTask: boolean;
  taskType: string;                  // thesis, literature_review, experiment_report, etc.
  taskName: string;
  suggestedSteps: SopStep[];
  informationComplete: boolean;
  missingInfo: string[];
}

// ─── 记忆键 ─────────────────────────────────────────────────────

const SOP_ACTIVE_KEY = 'sop:active';
const SOP_TASK_PREFIX = 'sop:task:';

function sopTaskKey(taskId: string): string {
  return `${SOP_TASK_PREFIX}${taskId}`;
}

// ─── AI 分析任务 ────────────────────────────────────────────────

/**
 * AI 分析用户消息，判断是否为学术任务并拆解步骤
 */
export async function aiAnalyzeTask(userMessage: string): Promise<TaskAnalysis> {
  const prompt = `分析以下用户消息，判断是否为学术研究任务。

用户消息：
"""
${userMessage.slice(0, 4000)}
"""

请以 JSON 格式回复：
{
  "isAcademicTask": true/false,
  "taskType": "thesis" | "literature_review" | "experiment_report" | "research_project" | "none",
  "taskName": "任务名称（简短概括）",
  "suggestedSteps": [
    { "step": 1, "name": "步骤名称", "description": "步骤描述" },
    ...
  ],
  "informationComplete": true/false,
  "missingInfo": ["缺失信息1", "缺失信息2"]
}

注意：
1. 步骤1 固定为"任务拆解与确认"
2. 步骤数量根据任务复杂度动态决定（通常 4-10 步）
3. 最后一步通常是"生成最终输出"（论文/报告等）
4. 如果用户已提供完整信息，informationComplete = true
5. 只回复 JSON，不要其他内容`;

  try {
    const response = await chat([{ role: 'user', content: prompt }], {
      maxTokens: 1000,
      temperature: 0.3,
    });

    const text = typeof response.content === 'string' ? response.content : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { isAcademicTask: false, taskType: 'none', taskName: '', suggestedSteps: [], informationComplete: false, missingInfo: [] };
    }

    return JSON.parse(jsonMatch[0]) as TaskAnalysis;
  } catch (e) {
    console.error('[SOP] AI analyze task failed:', e);
    return { isAcademicTask: false, taskType: 'none', taskName: '', suggestedSteps: [], informationComplete: false, missingInfo: [] };
  }
}

// ─── SOP 状态管理 ────────────────────────────────────────────────

/**
 * 获取用户当前活跃的 SOP 任务
 */
export async function getActiveSopTask(agentId: string, sessionKey: string): Promise<SopState | null> {
  const rows = await queryOne<{ memory_value: string }>(
    `SELECT memory_value FROM agent_memory
     WHERE agent_id = $1 AND memory_key = $2
     ORDER BY created_at DESC LIMIT 1`,
    [agentId, `${SOP_ACTIVE_KEY}:${sessionKey}`]
  );

  if (!rows) return null;

  try {
    const taskId = JSON.parse(rows.memory_value).taskId;
    return await getSopState(agentId, taskId);
  } catch {
    return null;
  }
}

/**
 * 获取用户所有进行中的 SOP 任务
 */
export async function listActiveSopTasks(agentId: string): Promise<SopState[]> {
  const rows = await query<{ memory_key: string; memory_value: string }>(
    `SELECT memory_key, memory_value FROM agent_memory
     WHERE agent_id = $1 AND memory_key LIKE $2
     ORDER BY created_at DESC`,
    [agentId, `${SOP_TASK_PREFIX}%`]
  );

  const tasks: SopState[] = [];
  for (const row of rows) {
    try {
      const state = JSON.parse(row.memory_value) as SopState;
      if (state.status === 'active') {
        tasks.push(state);
      }
    } catch { /* skip */ }
  }
  return tasks;
}

/**
 * 获取 SOP 状态
 */
export async function getSopState(agentId: string, taskId: string): Promise<SopState | null> {
  const rows = await queryOne<{ memory_value: string }>(
    `SELECT memory_value FROM agent_memory
     WHERE agent_id = $1 AND memory_key = $2
     ORDER BY created_at DESC LIMIT 1`,
    [agentId, sopTaskKey(taskId)]
  );

  if (!rows) return null;
  try {
    return JSON.parse(rows.memory_value) as SopState;
  } catch {
    return null;
  }
}

/**
 * 保存 SOP 状态
 */
export async function saveSopState(state: SopState): Promise<void> {
  const key = sopTaskKey(state.taskId);
  await addMemory(state.agentId, key, JSON.stringify(state), {
    type: 'sop_state',
    taskId: state.taskId,
    status: state.status,
  });

  // 同时更新活跃任务指针
  await addMemory(state.agentId, `${SOP_ACTIVE_KEY}:${state.sessionKey}`, JSON.stringify({ taskId: state.taskId }), {
    type: 'sop_active',
  });
}

/**
 * 创建新的 SOP 流程
 */
export async function createSop(
  agentId: string,
  sessionKey: string,
  analysis: TaskAnalysis,
  userMessage: string
): Promise<SopState> {
  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const state: SopState = {
    taskId,
    sessionKey,
    agentId,
    taskName: analysis.taskName,
    taskSummary: userMessage.slice(0, 500),
    steps: analysis.suggestedSteps.map((s, i) => ({
      ...s,
      step: i + 1,
      status: i === 0 ? 'in_progress' : 'pending',
      userData: null,
      subAgentResult: null,
      approved: false,
      reviewNote: null,
      subAgentId: null,
    })),
    currentStep: 1,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveSopState(state);
  console.log(`[SOP] Created: ${taskId} - ${analysis.taskName}`);
  return state;
}

// ─── AI 引导生成 ────────────────────────────────────────────────

/**
 * AI 生成当前步骤的引导文本
 */
export async function generateStepGuidance(state: SopState): Promise<string> {
  const currentStep = state.steps[state.currentStep - 1];
  if (!currentStep) return '流程已完成。';

  const prompt = `你是学术研究 SOP 流程引导助手。

当前任务：${state.taskName}
当前步骤：${currentStep.step}/${state.steps.length} - ${currentStep.name}
步骤描述：${currentStep.description || '无'}

已完成步骤：
${state.steps.filter(s => s.status === 'done').map(s => `- ${s.name}: ${s.userData?.slice(0, 100) || '已完成'}`).join('\n') || '无'}

请生成一段简短的引导文本（50-100字），引导用户完成当前步骤。
要求：
1. 友好、专业
2. 明确告诉用户需要做什么
3. 如果需要用户提交数据，说明数据格式要求`;

  try {
    const response = await chat([{ role: 'user', content: prompt }], {
      maxTokens: 200,
      temperature: 0.7,
    });
    return typeof response.content === 'string' ? response.content : '请完成当前步骤。';
  } catch (e) {
    return `请完成步骤 ${currentStep.step}: ${currentStep.name}`;
  }
}

// ─── 子 Agent 管理 ───────────────────────────────────────────────

/**
 * 为当前步骤创建子 Agent
 */
export async function createStepSubAgent(state: SopState): Promise<string | null> {
  const currentStep = state.steps[state.currentStep - 1];
  if (!currentStep) return null;

  const soulContent = JSON.stringify({
    role: `${currentStep.name}助手`,
    personality: '专业、严谨、注重细节',
    rules: [
      '基于用户提供的真实数据进行分析',
      '不要编造数据或结论',
      '输出结构清晰、逻辑连贯',
    ],
    skills: [currentStep.name, '数据分析', '学术写作'],
  });

  const agent = spawnSubAgent({
    name: `${currentStep.name}-agent`,
    soul_content: soulContent,
    parentId: state.agentId,
    ttlMs: 10 * 60 * 1000, // 10 分钟
    allowedTools: ['search_memory', 'web_search', 'read_file', 'write_file'],
  });

  // 更新状态
  currentStep.subAgentId = agent.id;
  await saveSopState(state);

  console.log(`[SOP] SubAgent created: ${agent.id} for step ${currentStep.step}`);
  return agent.id;
}

/**
 * 执行子 Agent 处理用户数据
 */
export async function executeSubAgent(
  state: SopState,
  userInput: string
): Promise<string> {
  const currentStep = state.steps[state.currentStep - 1];
  if (!currentStep || !currentStep.subAgentId) {
    throw new Error('No active sub agent for current step');
  }

  const agent = getSubAgent(currentStep.subAgentId);
  if (!agent) {
    throw new Error('Sub agent not found');
  }

  // 构建任务
  const task = `用户提交数据：
"""
${userInput}
"""

任务上下文：
- 任务名称：${state.taskName}
- 当前步骤：${currentStep.name}
- 步骤描述：${currentStep.description || '无'}

请基于用户提交的数据，完成以下工作：
1. 分析数据内容
2. 提供专业建议或处理结果
3. 如果发现问题，指出并提供修改建议

注意：必须基于用户提供的真实数据，不要编造。`;

  const result = await runSubAgentTask(agent, task, state.agentId);

  // 保存结果
  currentStep.subAgentResult = result;
  await saveSopState(state);

  return result;
}

// ─── AI 审核 ─────────────────────────────────────────────────────

export interface ReviewResult {
  approved: boolean;
  reason: string;
  suggestions: string[];
}

/**
 * AI 审核子 Agent 输出
 */
export async function aiReviewSubAgentOutput(state: SopState): Promise<ReviewResult> {
  const currentStep = state.steps[state.currentStep - 1];
  if (!currentStep) {
    return { approved: false, reason: '无当前步骤', suggestions: [] };
  }

  const prompt = `你是 SOP 流程审核员，负责审核子 Agent 的输出质量。

任务信息：
- 任务名称：${state.taskName}
- 当前步骤：${currentStep.step}/${state.steps.length} - ${currentStep.name}

用户提交数据：
"""
${currentStep.userData?.slice(0, 1000) || '无'}
"""

子 Agent 输出：
"""
${currentStep.subAgentResult?.slice(0, 2000) || '无'}
"""

请审核以下内容：
1. **幻觉检测**：子 Agent 是否基于用户数据进行分析？有没有编造数据或结论？
2. **环境一致性**：输出是否符合当前任务上下文？是否与前面步骤逻辑连贯？
3. **完整性**：是否完整回答了当前步骤的问题？

以 JSON 格式回复：
{
  "approved": true/false,
  "reason": "审核结论原因",
  "suggestions": ["改进建议1", "改进建议2"]
}

只回复 JSON，不要其他内容。`;

  try {
    const response = await chat([{ role: 'user', content: prompt }], {
      maxTokens: 300,
      temperature: 0.3,
    });

    const text = typeof response.content === 'string' ? response.content : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { approved: true, reason: '审核通过', suggestions: [] };
    }

    return JSON.parse(jsonMatch[0]) as ReviewResult;
  } catch (e) {
    console.error('[SOP] AI review failed:', e);
    return { approved: true, reason: '审核通过（默认）', suggestions: [] };
  }
}

// ─── 步骤推进 ─────────────────────────────────────────────────────

/**
 * 提交用户数据并处理
 */
export async function submitUserData(
  state: SopState,
  userInput: string
): Promise<{ state: SopState; subAgentResult: string }> {
  const currentStep = state.steps[state.currentStep - 1];
  if (!currentStep) {
    throw new Error('No current step');
  }

  // 保存用户数据
  currentStep.userData = userInput;
  currentStep.status = 'in_progress';

  // 创建并执行子 Agent
  await createStepSubAgent(state);
  const result = await executeSubAgent(state, userInput);

  state.updatedAt = new Date().toISOString();
  await saveSopState(state);

  return { state, subAgentResult: result };
}

/**
 * 审核通过，推进到下一步
 */
export async function approveAndAdvance(state: SopState): Promise<SopState> {
  const currentStep = state.steps[state.currentStep - 1];
  if (!currentStep) return state;

  // 标记当前步骤完成
  currentStep.status = 'done';
  currentStep.approved = true;

  // 销毁子 Agent
  if (currentStep.subAgentId) {
    destroySubAgent(currentStep.subAgentId, state.agentId);
    currentStep.subAgentId = null;
  }

  // 推进到下一步
  if (state.currentStep < state.steps.length) {
    state.currentStep += 1;
    state.steps[state.currentStep - 1].status = 'in_progress';
  } else {
    state.status = 'completed';
  }

  state.updatedAt = new Date().toISOString();
  await saveSopState(state);

  return state;
}

/**
 * 审核打回，重新执行当前步骤
 */
export async function rejectAndRetry(state: SopState, reason: string): Promise<SopState> {
  const currentStep = state.steps[state.currentStep - 1];
  if (!currentStep) return state;

  // 记录审核意见
  currentStep.reviewNote = reason;
  currentStep.approved = false;

  // 销毁子 Agent，准备重新创建
  if (currentStep.subAgentId) {
    destroySubAgent(currentStep.subAgentId, state.agentId);
    currentStep.subAgentId = null;
  }

  // 重置步骤状态
  currentStep.subAgentResult = null;

  state.updatedAt = new Date().toISOString();
  await saveSopState(state);

  return state;
}

/**
 * 用户确认任务拆解
 */
export async function confirmTaskBreakdown(state: SopState, confirmed: boolean): Promise<SopState> {
  const step1 = state.steps[0];
  if (!step1 || step1.step !== 1) return state;

  if (confirmed) {
    step1.status = 'done';
    step1.approved = true;
    step1.userData = '用户已确认任务拆解';

    if (state.steps.length > 1) {
      state.currentStep = 2;
      state.steps[1].status = 'in_progress';
    } else {
      state.status = 'completed';
    }
  }

  state.updatedAt = new Date().toISOString();
  await saveSopState(state);

  return state;
}

// ─── 取消/重启 ────────────────────────────────────────────────────

/**
 * 取消 SOP 流程
 */
export async function cancelSop(state: SopState): Promise<void> {
  state.status = 'cancelled';
  state.updatedAt = new Date().toISOString();

  // 销毁所有活跃的子 Agent
  for (const step of state.steps) {
    if (step.subAgentId) {
      destroySubAgent(step.subAgentId, state.agentId);
    }
  }

  await saveSopState(state);
}

/**
 * 重启某个步骤
 */
export async function restartStep(state: SopState, stepNumber: number): Promise<SopState> {
  if (stepNumber < 1 || stepNumber > state.steps.length) return state;

  // 销毁当前步骤的子 Agent
  const currentStep = state.steps[state.currentStep - 1];
  if (currentStep?.subAgentId) {
    destroySubAgent(currentStep.subAgentId, state.agentId);
  }

  // 重置从 stepNumber 开始的所有步骤
  for (let i = stepNumber - 1; i < state.steps.length; i++) {
    const step = state.steps[i];
    step.status = i === stepNumber - 1 ? 'in_progress' : 'pending';
    step.userData = null;
    step.subAgentResult = null;
    step.approved = false;
    step.reviewNote = null;
    step.subAgentId = null;
  }

  state.currentStep = stepNumber;
  state.status = 'active';
  state.updatedAt = new Date().toISOString();
  await saveSopState(state);

  return state;
}

// ─── 边界控制 ─────────────────────────────────────────────────────

/**
 * 检测用户是否要求退出 SOP
 */
export function detectExitIntent(userMessage: string): boolean {
  const exitPatterns = [
    /退出sop/i, /结束流程/i, /取消任务/i, /退出流程/i,
    /不要继续/i, /停止/i, /cancel sop/i, /exit sop/i,
  ];
  return exitPatterns.some(p => p.test(userMessage));
}

/**
 * 检测用户是否要求重启某个步骤
 */
export function detectRestartIntent(userMessage: string): number | null {
  const match = userMessage.match(/重启步骤\s*(\d+)/i) ||
                userMessage.match(/回到步骤\s*(\d+)/i) ||
                userMessage.match(/重新执行步骤\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 检测用户是否确认
 */
export function detectConfirmation(userMessage: string): boolean {
  const confirmPatterns = [
    /^确认$/, /^是的$/, /^对$/, /^ok$/i, /^好$/, /^可以$/,
    /^确认任务拆解$/, /^同意$/,
  ];
  return confirmPatterns.some(p => p.test(userMessage.trim()));
}

/**
 * 检测用户是否要求修改
 */
export function detectModification(userMessage: string): boolean {
  const modifyPatterns = [
    /修改步骤/, /调整步骤/, /增加步骤/, /删除步骤/,
    /修改任务/, /调整任务/,
  ];
  return modifyPatterns.some(p => p.test(userMessage));
}

// ─── 格式化输出 ───────────────────────────────────────────────────

/**
 * 格式化 SOP 状态为用户可读文本
 */
export function formatSopStatus(state: SopState): string {
  const lines: string[] = [
    `📋 **${state.taskName}**`,
    `进度：${state.currentStep}/${state.steps.length}`,
    '',
    '**步骤列表：**',
  ];

  for (const step of state.steps) {
    const icon = step.status === 'done' ? '✅' :
                 step.status === 'in_progress' ? '🔄' :
                 step.status === 'blocked' ? '⚠️' : '⏳';
    const current = step.step === state.currentStep ? ' ← 当前' : '';
    lines.push(`${icon} ${step.step}. ${step.name}${current}`);
  }

  return lines.join('\n');
}

/**
 * 格式化任务拆解结果
 */
export function formatTaskBreakdown(state: SopState): string {
  const lines: string[] = [
    `📋 **任务拆解结果**`,
    '',
    `**任务名称：** ${state.taskName}`,
    '',
    '**执行步骤：**',
  ];

  for (const step of state.steps) {
    lines.push(`${step.step}. **${step.name}**`);
    if (step.description) {
      lines.push(`   ${step.description}`);
    }
  }

  lines.push('');
  lines.push('请确认是否开始执行？回复"确认"开始，或提出修改意见。');

  return lines.join('\n');
}
