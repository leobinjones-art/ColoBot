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
  status: 'active' | 'paused' | 'completed' | 'cancelled';
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
  researchPurpose?: 'paper' | 'research' | 'learning';  // 写论文、做研究、学习
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
  console.log('[SOP] Analyzing task, message length:', userMessage.length);

  const prompt = `分析以下用户消息，判断是否为学术研究任务。

用户消息：
"""
${userMessage.slice(0, 4000)}
"""

请以 JSON 格式回复：
{
  "isAcademicTask": true/false,
  "taskType": "thesis" | "literature_review" | "experiment_report" | "research_project" | "learning" | "none",
  "taskName": "任务名称（简短概括）",
  "researchPurpose": "paper" | "research" | "learning" | null,
  "suggestedSteps": [
    { "step": 1, "name": "步骤名称", "description": "步骤描述" },
    ...
  ],
  "informationComplete": true/false,
  "missingInfo": ["缺失信息1", "缺失信息2"]
}

注意：
1. researchPurpose 判断规则：
   - "paper"：用户明确要写论文、发表期刊、毕业论文
   - "research"：用户要做科学研究、实验、分析，不是写论文
   - "learning"：用户要学习某个领域的知识
   - null：无法判断，需要询问用户
2. 如果用户说"学术研究"、"做研究"、"科研"等，researchPurpose = "research"
3. 如果用户只是说"开始学术"、"开始研究"等意图表达，但没有提供具体课题/主题，则 informationComplete = false，missingInfo 应包含"课题主题"、"研究目的"等
4. **步骤数量必须根据任务复杂度灵活决定**：
   - 简单任务：2-4 步（如快速调研、简单学习）
   - 中等任务：4-6 步（如标准研究、课程论文）
   - 复杂任务：6-10 步（如毕业论文、大型研究项目）
   - 不要总是生成相同数量的步骤，要根据实际需求调整
5. 如果用户已提供完整信息（包括具体课题和研究目的），informationComplete = true
6. 只回复 JSON，不要其他内容`;

  try {
    const response = await chat([{ role: 'user', content: prompt }], {
      maxTokens: 1000,
      temperature: 0.3,
    });

    const text = typeof response.content === 'string' ? response.content : '';
    console.log('[SOP] AI response:', text.slice(0, 200));
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[SOP] No JSON found in response');
      return { isAcademicTask: false, taskType: 'none', taskName: '', suggestedSteps: [], informationComplete: false, missingInfo: [] };
    }

    const result = JSON.parse(jsonMatch[0]) as TaskAnalysis;
    console.log('[SOP] Analysis result:', result.isAcademicTask, result.taskType, result.taskName);
    return result;
  } catch (e) {
    console.error('[SOP] AI analyze task failed:', e);
    return { isAcademicTask: false, taskType: 'none', taskName: '', suggestedSteps: [], informationComplete: false, missingInfo: [] };
  }
}

// ─── SOP 状态管理 ────────────────────────────────────────────────

/**
 * 获取用户当前活跃的 SOP 任务
 * @param includeCompleted 是否包含已完成的任务（用于最终输出生成）
 */
export async function getActiveSopTask(agentId: string, sessionKey: string, includePaused = false, includeCompleted = false): Promise<SopState | null> {
  console.log('[SOP] getActiveSopTask called:', agentId, sessionKey);
  try {
    const rows = await queryOne<{ memory_value: string }>(
      `SELECT memory_value FROM agent_memory
       WHERE agent_id = $1 AND memory_key = $2
       ORDER BY created_at DESC LIMIT 1`,
      [agentId, `${SOP_ACTIVE_KEY}:${sessionKey}`]
    );

    if (!rows) {
      console.log('[SOP] No active task found');
      return null;
    }

    try {
      const taskId = JSON.parse(rows.memory_value).taskId;
      console.log('[SOP] Found taskId:', taskId);
      const state = await getSopState(agentId, taskId);
      // 返回活跃状态的任务（或包含暂停/完成状态）
      if (state && (
        state.status === 'active' ||
        (includePaused && state.status === 'paused') ||
        (includeCompleted && state.status === 'completed')
      )) {
        return state;
      }
      console.log('[SOP] Task not active:', state?.status);
      return null;
    } catch (e) {
      console.error('[SOP] Failed to parse active task:', e);
      return null;
    }
  } catch (e) {
    console.error('[SOP] getActiveSopTask failed:', e);
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
      if (state.status === 'active' || state.status === 'paused') {
        tasks.push(state);
      }
    } catch { /* skip */ }
  }
  return tasks;
}

/**
 * 格式化 SOP 任务列表（AI 动态生成）
 */
export async function formatSopList(tasks: SopState[]): Promise<string> {
  if (tasks.length === 0) {
    return '📋 No active SOP tasks.\n\nSend a new task to start a workflow.';
  }

  const tasksInfo = tasks.map((t, i) => `${i + 1}. ${t.taskName} - Step ${t.currentStep}/${t.steps.length} (${t.status})`).join('\n');

  const prompt = `Generate a formatted task list for the following SOP workflows.

Tasks:
${tasksInfo}

Generate a clear task list with:
1. A header with emoji
2. Numbered list of tasks with status
3. A call-to-action at the end
4. Use English language

Response (just the formatted message):`;

  try {
    const response = await chat([
      { role: 'system', content: 'You are a helpful workflow assistant.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: 300 });

    const content = response.content;
    const text = typeof content === 'string' ? content : (content as Array<{ type: string; text?: string }>).map(b => b.text || '').join('');
    return text.trim() || formatSopListFallback(tasks);
  } catch (e) {
    return formatSopListFallback(tasks);
  }
}

function formatSopListFallback(tasks: SopState[]): string {
  const lines: string[] = ['📋 **SOP Task List**\n'];
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const statusIcon = task.status === 'paused' ? '⏸️' : '🔄';
    lines.push(`${i + 1}. ${statusIcon} **${task.taskName}**`);
    lines.push(`   Progress: ${task.currentStep}/${task.steps.length} | Status: ${task.status}`);
  }
  return lines.join('\n');
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
  try {
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
    console.log('[SOP] State saved:', state.taskId);
  } catch (e) {
    console.error('[SOP] Failed to save state:', e);
    throw e;
  }
}

/**
 * 保存步骤进度摘要到记忆（便于后续检索）
 */
export async function saveStepProgress(state: SopState): Promise<void> {
  const currentStep = state.steps[state.currentStep - 1];
  if (!currentStep || !currentStep.subAgentResult) return;

  try {
    // 写入进度摘要
    const progressKey = `sop_progress:${state.taskId}:step${currentStep.step}`;
    const progressContent = `【${state.taskName}】步骤${currentStep.step}/${state.steps.length}：${currentStep.name}

用户输入：${currentStep.userData || '无'}

处理结果：
${currentStep.subAgentResult.slice(0, 1000)}`;

    await addMemory(state.agentId, progressKey, progressContent, {
      type: 'sop_progress',
      taskId: state.taskId,
      step: currentStep.step,
      stepName: currentStep.name,
    });

    console.log('[SOP] Progress saved for step', currentStep.step);
  } catch (e) {
    console.error('[SOP] Failed to save progress:', e);
  }
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
 * 父Agent整理汇总子Agent结果
 */
export async function summarizeSubAgentResult(state: SopState, subAgentResult: string): Promise<string> {
  const currentStep = state.steps[state.currentStep - 1];
  if (!currentStep) return subAgentResult;

  const prompt = `你是学术研究SOP流程的父Agent，负责整理汇总子Agent的工作成果。

任务信息：
- 任务名称：${state.taskName}
- 当前步骤：${currentStep.step}/${state.steps.length} - ${currentStep.name}

子Agent原始输出：
"""
${subAgentResult.slice(0, 4000)}
"""

请整理汇总以上内容，要求：
1. 提取核心信息，去除冗余和格式噪音
2. 以专业、简洁的方式呈现给用户
3. 如果是文献列表，整理成规范格式
4. 如果是分析结果，提炼关键结论
5. 控制在300-500字以内

直接输出整理后的内容，不要添加"以下是整理结果"等前缀。`;

  try {
    const response = await chat([{ role: 'user', content: prompt }], {
      maxTokens: 800,
      temperature: 0.3,
    });
    return typeof response.content === 'string' ? response.content : subAgentResult;
  } catch (e) {
    console.error('[SOP] Summarize failed:', e);
    return subAgentResult;
  }
}

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

// ─── 子 Agent 类型定义 ────────────────────────────────────────────

export type SubAgentType = 'search' | 'analysis' | 'writing' | 'review' | 'general';

export const SUB_AGENT_CONFIGS: Record<SubAgentType, {
  personality: string;
  rules: string[];
  skills: string[];
  tools: string[];
}> = {
  search: {
    personality: '严谨、全面、注重来源',
    rules: [
      '使用 academic_search 或 web_search 工具搜索',
      '优先使用学术搜索引擎',
      '标注文献来源和年份',
      '如果搜索不可用，基于专业知识推荐经典文献',
    ],
    skills: ['文献检索', '信息筛选', '来源验证'],
    tools: ['web_search', 'academic_search', 'search_memory'],
  },
  analysis: {
    personality: '逻辑严密、数据驱动、客观',
    rules: [
      '基于真实数据进行分析',
      '不编造数据或结论',
      '提供推理过程',
      '指出局限性',
    ],
    skills: ['数据分析', '逻辑推理', '批判性思维'],
    tools: ['search_memory', 'read_file', 'web_search'],
  },
  writing: {
    personality: '专业、规范、注重结构',
    rules: [
      '遵循学术写作规范',
      '结构清晰、逻辑连贯',
      '引用来源标注',
      '避免抄袭，原创表达',
    ],
    skills: ['学术写作', '论文结构', '文献引用'],
    tools: ['search_memory', 'read_file', 'write_file'],
  },
  review: {
    personality: '严格、公正、细致',
    rules: [
      '检测幻觉和编造内容',
      '验证逻辑一致性',
      '检查引用来源',
      '提出具体改进建议',
    ],
    skills: ['内容审核', '质量评估', '问题诊断'],
    tools: ['search_memory', 'web_search'],
  },
  general: {
    personality: '专业、严谨、注重细节',
    rules: [
      '基于用户提供的真实数据进行分析',
      '不编造数据或结论',
      '输出结构清晰、逻辑连贯',
    ],
    skills: ['问题处理', '信息整理'],
    tools: ['search_memory', 'web_search', 'read_file', 'write_file'],
  },
};

/**
 * 根据步骤名称判断子Agent类型
 */
export function detectSubAgentType(stepName: string): SubAgentType {
  const name = stepName.toLowerCase();
  if (name.includes('文献') || name.includes('调研') || name.includes('搜索') || name.includes('检索')) {
    return 'search';
  }
  if (name.includes('分析') || name.includes('研究') || name.includes('计算') || name.includes('实验')) {
    return 'analysis';
  }
  if (name.includes('撰写') || name.includes('写作') || name.includes('论文') || name.includes('报告')) {
    return 'writing';
  }
  if (name.includes('审核') || name.includes('检查') || name.includes('评审')) {
    return 'review';
  }
  return 'general';
}

// ─── 子 Agent 管理 ───────────────────────────────────────────────

/**
 * 为当前步骤创建子 Agent
 */
export async function createStepSubAgent(state: SopState): Promise<string | null> {
  const currentStep = state.steps[state.currentStep - 1];
  if (!currentStep) return null;

  // 根据步骤类型选择子Agent配置
  const agentType = detectSubAgentType(currentStep.name);
  const config = SUB_AGENT_CONFIGS[agentType];

  const soulContent = JSON.stringify({
    role: `${currentStep.name}助手`,
    personality: config.personality,
    rules: config.rules,
    skills: [...config.skills, currentStep.name],
  });

  const agent = spawnSubAgent({
    name: `${currentStep.name}-agent`,
    soul_content: soulContent,
    parentId: state.agentId,
    ttlMs: 10 * 60 * 1000, // 10 分钟
    allowedTools: config.tools,
  });

  // 更新状态
  currentStep.subAgentId = agent.id;
  await saveSopState(state);

  console.log(`[SOP] SubAgent created: ${agent.id} for step ${currentStep.step} (type: ${agentType})`);
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
    console.error('[SOP] Sub agent not found:', currentStep.subAgentId);
    throw new Error('Sub agent not found');
  }

  console.log('[SOP] Executing sub agent:', agent.id, agent.name);

  // 根据步骤类型构建不同的任务描述
  const isSearchStep = currentStep.name.includes('文献') || currentStep.name.includes('调研') || currentStep.name.includes('搜索');
  const isAnalysisStep = currentStep.name.includes('分析') || currentStep.name.includes('研究');

  let task: string;
  if (isSearchStep) {
    // 文献检索步骤：用户输入是搜索指令
    task = `用户请求：${userInput}

任务上下文：
- 任务名称：${state.taskName}
- 当前步骤：${currentStep.name}
- 步骤描述：${currentStep.description || '无'}

请执行以下操作：
1. 使用 academic_search 工具搜索相关学术文献
2. 如果搜索工具不可用，基于专业知识推荐经典文献
3. 整理文献列表，包含标题、作者、年份、来源
4. 提供每篇文献的简要说明和研究价值

注意：优先使用搜索工具获取真实文献，工具不可用时才使用专业知识推荐。`;
  } else if (isAnalysisStep) {
    // 分析步骤：用户输入可能是数据或指令
    task = `用户输入：${userInput}

任务上下文：
- 任务名称：${state.taskName}
- 当前步骤：${currentStep.name}
- 步骤描述：${currentStep.description || '无'}

请根据用户输入内容判断：
- 如果是执行指令（如"搜索"、"分析"），直接执行相应操作
- 如果是数据（如文献列表、实验数据），进行分析处理

提供专业、结构化的处理结果。`;
  } else {
    // 其他步骤：通用处理
    task = `用户输入：${userInput}

任务上下文：
- 任务名称：${state.taskName}
- 当前步骤：${currentStep.name}
- 步骤描述：${currentStep.description || '无'}

请根据当前步骤要求，处理用户输入并提供专业结果。`;
  }

  console.log('[SOP] Task for sub agent:', task.slice(0, 200));

  try {
    const result = await runSubAgentTask(agent, task, state.agentId);
    console.log('[SOP] Sub agent result length:', result.length);

    // 保存结果
    currentStep.subAgentResult = result;
    await saveSopState(state);

    return result;
  } catch (e) {
    console.error('[SOP] runSubAgentTask failed:', e);
    throw e;
  }
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

  // 根据步骤类型调整审核重点
  const agentType = detectSubAgentType(currentStep.name);
  const reviewFocus = agentType === 'search'
    ? '文献来源是否标注？年份和作者信息是否完整？是否使用了搜索工具？'
    : agentType === 'analysis'
    ? '分析是否基于真实数据？推理过程是否清晰？是否指出局限性？'
    : agentType === 'writing'
    ? '结构是否清晰？引用是否标注？是否符合学术规范？'
    : '内容是否完整？逻辑是否连贯？';

  const prompt = `你是 SOP 流程审核员，负责审核子 Agent 的输出质量。

任务信息：
- 任务名称：${state.taskName}
- 当前步骤：${currentStep.step}/${state.steps.length} - ${currentStep.name}
- 步骤类型：${agentType}

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
4. **类型专项审核**：${reviewFocus}

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

  // 保存子 Agent 结果
  currentStep.subAgentResult = result;

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

  // 保存步骤进度到记忆
  await saveStepProgress(state);

  // 销毁子 Agent
  if (currentStep.subAgentId) {
    destroySubAgent(currentStep.subAgentId, state.agentId);
    currentStep.subAgentId = null;
  }

  // 推进到下一步
  if (state.currentStep < state.steps.length) {
    state.currentStep += 1;
    const nextStep = state.steps[state.currentStep - 1];
    nextStep.status = 'in_progress';

    // 自动执行子Agent生成引导
    await createStepSubAgent(state);
    const result = await executeSubAgent(state, `请为步骤"${nextStep.name}"生成引导内容，帮助用户理解需要做什么。步骤描述：${nextStep.description || '无'}`);
    nextStep.subAgentResult = result;
    nextStep.userData = '自动生成引导';
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
 * 暂停 SOP 流程
 */
export async function pauseSop(state: SopState): Promise<void> {
  state.status = 'paused';
  state.updatedAt = new Date().toISOString();

  // 销毁当前步骤的子 Agent（保留进度）
  const currentStep = state.steps[state.currentStep - 1];
  if (currentStep?.subAgentId) {
    destroySubAgent(currentStep.subAgentId, state.agentId);
    currentStep.subAgentId = null;
  }

  await saveSopState(state);
}

/**
 * 恢复 SOP 流程
 */
export async function resumeSop(state: SopState): Promise<SopState> {
  if (state.status !== 'paused') return state;

  state.status = 'active';
  state.updatedAt = new Date().toISOString();
  await saveSopState(state);
  return state;
}

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
 * 检测用户是否要求退出 SOP（取消）
 */
export function detectExitIntent(userMessage: string): boolean {
  const exitPatterns = [
    /退出sop/i, /结束流程/i, /取消任务/i, /退出流程/i,
    /不要继续/i, /cancel sop/i, /exit sop/i,
  ];
  return exitPatterns.some(p => p.test(userMessage));
}

/**
 * 检测用户是否要求暂停 SOP
 */
export function detectPauseIntent(userMessage: string): boolean {
  const pausePatterns = [
    /暂停sop/i, /暂停$/i, /stop$/i,
  ];
  return pausePatterns.some(p => p.test(userMessage.trim()));
}

/**
 * 检测用户是否要求恢复 SOP
 */
export function detectResumeIntent(userMessage: string): boolean {
  const resumePatterns = [
    /继续sop/i, /恢复sop/i, /恢复$/i, /resume sop/i, /resume$/i,
  ];
  return resumePatterns.some(p => p.test(userMessage.trim()));
}

/**
 * 检测用户是否要求查看 SOP 列表
 */
export function detectListIntent(userMessage: string): boolean {
  const listPatterns = [
    /sop列表/i, /查看sop/i, /我的sop/i, /任务列表/i,
  ];
  return listPatterns.some(p => p.test(userMessage.trim()));
}

/**
 * 检测用户是否要求新建 SOP
 */
export function detectNewSopIntent(userMessage: string): boolean {
  const newPatterns = [
    /新建sop/i, /新sop/i, /开始学术/i, /开始研究/i,
  ];
  return newPatterns.some(p => p.test(userMessage.trim()));
}

/**
 * 检测用户是否选择任务编号
 */
export function detectTaskSelection(userMessage: string): number | null {
  const match = userMessage.trim().match(/^(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * 检测用户选择的研究目的
 */
export function detectResearchPurpose(userMessage: string): 'paper' | 'research' | 'learning' | null {
  const msg = userMessage.trim().toLowerCase();
  if (msg === '1' || msg.includes('论文') || msg.includes('paper')) return 'paper';
  if (msg === '2' || msg.includes('研究') || msg.includes('research') || msg.includes('不是写论文') || msg.includes('科研')) return 'research';
  if (msg === '3' || msg.includes('学习') || msg.includes('learning')) return 'learning';
  return null;
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
    /^确认/, /^是的$/, /^对$/, /^ok$/i, /^好/, /^可以$/,
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
 * 格式化 SOP 状态为用户可读文本（AI 动态生成）
 */
export async function formatSopStatus(state: SopState): Promise<string> {
  const stepsInfo = state.steps.map(s => {
    const status = s.status === 'done' ? '✅' : s.status === 'in_progress' ? '🔄' : '⏳';
    const current = s.step === state.currentStep ? ' (current)' : '';
    return `${status} ${s.step}. ${s.name}${current}`;
  }).join('\n');

  const prompt = `Generate a status summary for the following SOP workflow.

Task: ${state.taskName}
Current step: ${state.currentStep}/${state.steps.length}

Steps:
${stepsInfo}

Generate a concise status display with:
1. Task name with emoji
2. Progress indicator
3. Step list with status icons
4. Use English

Response (just the formatted status):`;

  try {
    const response = await chat([
      { role: 'system', content: 'You are a workflow status display generator.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: 300 });

    const content = response.content;
    const text = typeof content === 'string' ? content : (content as Array<{ type: string; text?: string }>).map(b => b.text || '').join('');
    return text.trim() || formatSopStatusFallback(state);
  } catch (e) {
    return formatSopStatusFallback(state);
  }
}

function formatSopStatusFallback(state: SopState): string {
  const lines: string[] = [
    `📋 **${state.taskName}**`,
    `Progress: ${state.currentStep}/${state.steps.length}`,
    '',
    '**Steps:**',
  ];

  for (const step of state.steps) {
    const icon = step.status === 'done' ? '✅' :
                 step.status === 'in_progress' ? '🔄' :
                 step.status === 'blocked' ? '⚠️' : '⏳';
    const current = step.step === state.currentStep ? ' (current)' : '';
    lines.push(`${icon} ${step.step}. ${step.name}${current}`);
  }

  return lines.join('\n');
}

/**
 * 格式化任务拆解结果（AI 动态生成）
 */
export async function formatTaskBreakdown(state: SopState): Promise<string> {
  const stepsInfo = state.steps.map(s => `${s.step}. ${s.name}${s.description ? `: ${s.description}` : ''}`).join('\n');

  // 使用 taskSummary 判断语言
  const isChinese = /[\u4e00-\u9fff]/.test(state.taskSummary);
  const languageHint = isChinese ? 'Use Chinese (中文)' : 'Use English';

  const prompt = `Generate a task breakdown summary for the following research workflow.

Task name: ${state.taskName}
Task summary: ${state.taskSummary}

Steps:
${stepsInfo}

Generate a clear, well-formatted task breakdown message. Guidelines:
1. Use appropriate emoji (📋, 🔢, etc.)
2. Number each step clearly
3. Include brief descriptions if available
4. End with a call-to-action asking user to confirm or modify
5. ${languageHint}

Response (just the formatted message):`;

  try {
    const response = await chat([
      { role: 'system', content: 'You are a helpful research workflow assistant. Generate clear, well-formatted task breakdowns in the user\'s language.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: 500 });

    const content = response.content;
    const text = typeof content === 'string' ? content : (content as Array<{ type: string; text?: string }>).map(b => b.text || '').join('');
    return text.trim() || formatTaskBreakdownFallback(state, isChinese);
  } catch (e) {
    console.error('[SOP] Failed to generate task breakdown:', e);
    return formatTaskBreakdownFallback(state, isChinese);
  }
}

/**
 * 备用任务拆解格式
 */
function formatTaskBreakdownFallback(state: SopState, isChinese: boolean): string {
  if (isChinese) {
    const lines: string[] = [
      `📋 **任务拆解**`,
      '',
      `**任务：** ${state.taskName}`,
      '',
      '**步骤：**',
    ];
    for (const step of state.steps) {
      lines.push(`${step.step}. **${step.name}**`);
      if (step.description) lines.push(`   ${step.description}`);
    }
    lines.push('');
    lines.push('回复"确认"开始执行，或提出修改意见。');
    return lines.join('\n');
  }

  const lines: string[] = [
    `📋 **Task Breakdown**`,
    '',
    `**Task:** ${state.taskName}`,
    '',
    '**Steps:**',
  ];
  for (const step of state.steps) {
    lines.push(`${step.step}. **${step.name}**`);
    if (step.description) lines.push(`   ${step.description}`);
  }
  lines.push('');
  lines.push('Reply "confirm" to start execution, or provide modifications.');
  return lines.join('\n');
}

// ─── 方案 C：用户偏好记忆 ─────────────────────────────────────────

interface UserPreference {
  preferredPurpose?: 'paper' | 'research' | 'learning';
  stepDetailLevel?: 'detailed' | 'concise';
  commonModifications: string[];
  lastTaskType?: string;
}

const SOP_PREFERENCE_KEY = 'sop:user_preference';

/**
 * 保存用户偏好到记忆
 */
export async function saveUserPreference(
  agentId: string,
  preference: Partial<UserPreference>
): Promise<void> {
  try {
    // 获取现有偏好
    const existing = await getUserPreference(agentId);
    const merged = { ...existing, ...preference };

    // 使用安全写入
    const { safeAddMemory } = await import('../services/safe-write.js');
    await safeAddMemory(agentId, SOP_PREFERENCE_KEY, JSON.stringify(merged), {
      type: 'sop_preference',
    }, {
      type: 'user_input',  // 用户偏好来自用户交互
      timestamp: new Date().toISOString(),
    });
    console.log('[SOP] User preference saved:', preference);
  } catch (e) {
    console.error('[SOP] Failed to save user preference:', e);
  }
}

/**
 * 获取用户偏好
 */
export async function getUserPreference(agentId: string): Promise<UserPreference> {
  try {
    const results = await searchMemory(agentId, SOP_PREFERENCE_KEY, 1);
    if (results.length > 0) {
      return JSON.parse(results[0].content) as UserPreference;
    }
  } catch (e) {
    console.error('[SOP] Failed to get user preference:', e);
  }
  return { commonModifications: [] };
}

/**
 * 记录用户研究目的选择
 */
export async function recordPurposeSelection(
  agentId: string,
  purpose: 'paper' | 'research' | 'learning'
): Promise<void> {
  const pref = await getUserPreference(agentId);
  await saveUserPreference(agentId, { ...pref, preferredPurpose: purpose });
}

/**
 * 记录用户修改意见
 */
export async function recordModification(
  agentId: string,
  modification: string
): Promise<void> {
  const pref = await getUserPreference(agentId);
  const mods = pref.commonModifications || [];
  // 保留最近 10 条修改意见
  mods.push(modification);
  if (mods.length > 10) mods.shift();
  await saveUserPreference(agentId, { ...pref, commonModifications: mods });
}

/**
 * 应用用户偏好到任务分析
 */
export async function applyUserPreference(
  agentId: string,
  analysis: TaskAnalysis
): Promise<TaskAnalysis> {
  const pref = await getUserPreference(agentId);

  // 如果用户有偏好目的且 AI 未检测出，使用偏好
  if (!analysis.researchPurpose && pref.preferredPurpose) {
    console.log('[SOP] Applying user preferred purpose:', pref.preferredPurpose);
    analysis.researchPurpose = pref.preferredPurpose;
  }

  return analysis;
}

// ─── 方案 D：流程自优化建议 ─────────────────────────────────────────

interface StepMetrics {
  stepName: string;
  executionCount: number;
  rejectionCount: number;
  avgExecutionTime: number;
  commonIssues: string[];
}

interface OptimizationSuggestion {
  stepIndex: number;
  stepName: string;
  issue: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

const SOP_METRICS_KEY = 'sop:metrics';

/**
 * 记录步骤执行指标
 */
export async function recordStepMetrics(
  agentId: string,
  taskId: string,
  stepIndex: number,
  stepName: string,
  rejected: boolean,
  executionTimeMs: number,
  issue?: string
): Promise<void> {
  try {
    const key = `${SOP_METRICS_KEY}:${taskId}:${stepIndex}`;
    await addMemory(agentId, key, JSON.stringify({
      stepName,
      rejected,
      executionTimeMs,
      issue: issue || null,
      timestamp: new Date().toISOString(),
    }), {
      type: 'sop_metrics',
      taskId,
      stepIndex,
    });
  } catch (e) {
    console.error('[SOP] Failed to record step metrics:', e);
  }
}

/**
 * 分析执行历史，生成优化建议
 */
export async function analyzeAndSuggestOptimizations(
  agentId: string
): Promise<OptimizationSuggestion[]> {
  try {
    // 搜索所有步骤指标
    const results = await searchMemory(agentId, SOP_METRICS_KEY, 50);
    if (results.length === 0) return [];

    // 按步骤名聚合
    const metricsByStep: Record<string, StepMetrics> = {};

    for (const result of results) {
      try {
        const data = JSON.parse(result.content);
        const stepName = data.stepName;

        if (!metricsByStep[stepName]) {
          metricsByStep[stepName] = {
            stepName,
            executionCount: 0,
            rejectionCount: 0,
            avgExecutionTime: 0,
            commonIssues: [],
          };
        }

        const m = metricsByStep[stepName];
        m.executionCount++;
        if (data.rejected) m.rejectionCount++;
        m.avgExecutionTime = (m.avgExecutionTime * (m.executionCount - 1) + data.executionTimeMs) / m.executionCount;
        if (data.issue) m.commonIssues.push(data.issue);
      } catch { /* skip */ }
    }

    // 生成建议
    const suggestions: OptimizationSuggestion[] = [];

    for (const [stepName, metrics] of Object.entries(metricsByStep)) {
      // 高打回率
      if (metrics.rejectionCount > 0 && metrics.executionCount > 0) {
        const rejectionRate = metrics.rejectionCount / metrics.executionCount;
        if (rejectionRate > 0.3) {
          suggestions.push({
            stepIndex: 0,
            stepName,
            issue: `打回率 ${(rejectionRate * 100).toFixed(0)}%`,
            suggestion: '考虑优化步骤描述或增加引导说明',
            priority: rejectionRate > 0.5 ? 'high' : 'medium',
          });
        }
      }

      // 执行时间过长
      if (metrics.avgExecutionTime > 60000) { // 超过 1 分钟
        suggestions.push({
          stepIndex: 0,
          stepName,
          issue: `平均执行时间 ${(metrics.avgExecutionTime / 1000).toFixed(0)} 秒`,
          suggestion: '考虑拆分为多个子步骤',
          priority: metrics.avgExecutionTime > 120000 ? 'high' : 'medium',
        });
      }

      // 常见问题
      if (metrics.commonIssues.length >= 3) {
        const uniqueIssues = [...new Set(metrics.commonIssues)];
        if (uniqueIssues.length > 0) {
          suggestions.push({
            stepIndex: 0,
            stepName,
            issue: `常见问题: ${uniqueIssues.slice(0, 3).join(', ')}`,
            suggestion: '考虑在步骤引导中预先说明注意事项',
            priority: 'low',
          });
        }
      }
    }

    // 按优先级排序
    suggestions.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });

    return suggestions;
  } catch (e) {
    console.error('[SOP] Failed to analyze optimizations:', e);
    return [];
  }
}

/**
 * 生成优化报告
 */
export async function generateOptimizationReport(agentId: string): Promise<string> {
  const suggestions = await analyzeAndSuggestOptimizations(agentId);

  if (suggestions.length === 0) {
    return '📊 **SOP 流程优化报告**\n\n暂无优化建议。继续使用以积累更多数据。';
  }

  const lines: string[] = [
    '📊 **SOP 流程优化报告**\n',
    `发现 ${suggestions.length} 条优化建议：\n`,
  ];

  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    const priorityIcon = s.priority === 'high' ? '🔴' : s.priority === 'medium' ? '🟡' : '🟢';
    lines.push(`${i + 1}. ${priorityIcon} **${s.stepName}**`);
    lines.push(`   问题：${s.issue}`);
    lines.push(`   建议：${s.suggestion}`);
    lines.push('');
  }

  lines.push('回复"应用优化"自动调整流程，或手动调整特定步骤。');

  return lines.join('\n');
}

// ─── 最终输出生成 ──────────────────────────────────────────────────

/**
 * 生成最终输出（论文/报告）
 * 汇总所有步骤结果，调用写作 Agent 生成结构化文档
 */
export async function generateFinalOutput(state: SopState): Promise<{ success: boolean; content: string; filePath?: string }> {
  // 1. 汇总所有步骤的结果
  const stepSummaries: string[] = [];
  for (const step of state.steps) {
    if (step.subAgentResult) {
      stepSummaries.push(`## ${step.name}\n\n${step.subAgentResult.slice(0, 2000)}`);
    }
  }

  // 2. 构建写作任务
  const task = `你是一个学术写作助手。请根据以下研究流程的各步骤结果，生成一份完整的研究报告。

# 任务信息
- 任务名称：${state.taskName}
- 任务摘要：${state.taskSummary}

# 各步骤结果

${stepSummaries.join('\n\n---\n\n')}

# 输出要求

请生成一份结构化的 Markdown 格式研究报告，包含：

1. **标题**：简洁明了的研究标题
2. **摘要**：200-300字的研究摘要
3. **引言**：研究背景和意义
4. **方法**：研究方法和实验设计
5. **结果**：主要研究发现（基于步骤结果）
6. **讨论**：结果分析和局限性
7. **结论**：总结和未来工作
8. **参考文献**：列出提到的文献（如有）

请直接输出 Markdown 格式的报告内容。`;

  // 3. 创建写作类型的子 Agent
  const writingConfig = SUB_AGENT_CONFIGS.writing;
  const soulContent = JSON.stringify({
    role: '学术写作助手',
    personality: writingConfig.personality,
    rules: writingConfig.rules,
    skills: [...writingConfig.skills, '研究报告撰写'],
  });

  const agent = spawnSubAgent({
    name: '最终输出-写作Agent',
    soul_content: soulContent,
    parentId: state.agentId,
    ttlMs: 15 * 60 * 1000, // 15 分钟
    allowedTools: ['search_memory', 'read_file', 'write_file'],
  });

  console.log(`[SOP] Final output agent created: ${agent.id}`);

  try {
    // 4. 执行写作任务
    const result = await runSubAgentTask(agent, task, state.agentId);

    // 5. 保存到文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `research-report-${timestamp}.md`;
    const filePath = `/workspace/${state.agentId}/${fileName}`;

    // 使用 write_file 工具保存
    const { executeToolCalls } = await import('./tools/executor.js');
    const writeResult = await executeToolCalls(
      [{ name: 'write_file', args: { file_path: filePath, content: result } }],
      { agentId: state.agentId, sessionKey: '' }
    );

    const savedPath = writeResult[0]?.success ? filePath : undefined;

    // 6. 销毁子 Agent
    destroySubAgent(agent.id, state.agentId);

    console.log(`[SOP] Final output generated: ${savedPath || 'memory only'}`);

    return {
      success: true,
      content: result,
      filePath: savedPath,
    };
  } catch (e) {
    console.error('[SOP] Final output generation failed:', e);
    destroySubAgent(agent.id, state.agentId);
    return {
      success: false,
      content: `生成失败：${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ─── AI 动态响应生成 ──────────────────────────────────────────────────

export type SopResponseType =
  | 'cancelled'
  | 'paused'
  | 'resumed'
  | 'restarted'
  | 'completed'
  | 'purpose_selection'
  | 'breakdown_confirm'
  | 'step_guidance'
  | 'step_submitted'
  | 'step_rejected'
  | 'step_advanced'
  | 'final_output_ready'
  | 'final_output_generated'
  | 'task_list'
  | 'no_active_task';

export interface SopResponseContext {
  type: SopResponseType;
  state?: SopState;
  taskName?: string;
  currentStep?: number;
  totalSteps?: number;
  stepName?: string;
  reason?: string;
  suggestions?: string[];
  result?: string;
  filePath?: string;
  downloadUrl?: string;
  tasks?: SopState[];
  userMessage?: string;
}

/**
 * AI 动态生成 SOP 响应
 * 根据上下文和用户语言偏好生成自然语言响应
 */
export async function generateSopResponse(context: SopResponseContext): Promise<string> {
  // 从 state.taskSummary 或 userMessage 判断语言
  const textToCheck = context.userMessage || context.state?.taskSummary || '';
  const isChinese = /[\u4e00-\u9fff]/.test(textToCheck);
  const languageHint = isChinese ? 'Use Chinese (中文)' : 'Use English';

  const prompt = `You are an AI assistant helping with a research workflow (SOP - Standard Operating Procedure).

Current context:
- Response type: ${context.type}
${context.state ? `- Task: ${context.state.taskName}` : ''}
${context.state ? `- Task summary: ${context.state.taskSummary}` : ''}
${context.taskName ? `- Task name: ${context.taskName}` : ''}
${context.currentStep !== undefined ? `- Current step: ${context.currentStep}/${context.totalSteps}` : ''}
${context.stepName ? `- Step name: ${context.stepName}` : ''}
${context.reason ? `- Reason: ${context.reason}` : ''}
${context.suggestions ? `- Suggestions: ${context.suggestions.join('; ')}` : ''}
${context.result ? `- Result preview: ${context.result.slice(0, 300)}...` : ''}
${context.filePath ? `- File saved: ${context.filePath}` : ''}
${context.downloadUrl ? `- Download URL: ${context.downloadUrl}` : ''}
${context.tasks ? `- Active tasks: ${context.tasks.length}` : ''}
${context.userMessage ? `- User message: ${context.userMessage}` : ''}

Generate a natural, helpful response for the user. Guidelines:
1. Be concise but informative
2. Use appropriate emoji for visual clarity (✅ ❌ 🎉 📋 🔄 ⏸️ etc.)
3. Include actionable next steps
4. If showing a file, make the download link clickable using markdown: [Download](url)
5. ${languageHint}
6. For task breakdown, show the steps clearly numbered
7. For progress updates, show current step vs total

Response (just the message, no JSON, no code blocks):`;

  try {
    const response = await chat([
      { role: 'system', content: 'You are a helpful research workflow assistant. Generate natural, concise responses in the user\'s language.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: 500 });

    const content = response.content;
    const text = typeof content === 'string' ? content : (content as Array<{ type: string; text?: string }>).map(b => b.text || '').join('');
    return text.trim() || generateFallbackResponse(context, isChinese);
  } catch (e) {
    console.error('[SOP] Failed to generate AI response:', e);
    return generateFallbackResponse(context, isChinese);
  }
}

/**
 * 备用响应（当 AI 生成失败时）
 */
function generateFallbackResponse(context: SopResponseContext, isChinese: boolean): string {
  if (isChinese) {
    switch (context.type) {
      case 'cancelled':
        return '✅ SOP 流程已取消。发送新任务开始新流程。';
      case 'paused':
        return `⏸️ SOP 流程已暂停。进度：步骤 ${context.currentStep}/${context.totalSteps}。发送"继续"恢复。`;
      case 'resumed':
        return `🔄 SOP 流程已恢复。当前步骤：${context.currentStep}/${context.totalSteps}`;
      case 'restarted':
        return `🔄 步骤 ${context.currentStep} 已重启。`;
      case 'completed':
        return '🎉 所有步骤已完成！是否生成最终输出（论文/报告）？回复"是"或"否"。';
      case 'purpose_selection':
        return `检测到学术任务：**${context.taskName}**\n\n请选择研究目的：\n\n1. **写论文** - 发表期刊/毕业论文\n2. **做研究** - 科学研究、实验、分析\n3. **学习** - 学习某个领域的知识\n\n请回复数字或描述您的目的。`;
      case 'breakdown_confirm':
        return '请回复"确认"开始执行，或提出修改意见。';
      case 'step_submitted':
        return '步骤已完成。回复"确认"继续下一步，或提出修改意见。';
      case 'step_rejected':
        return `❌ 审核未通过：${context.reason}\n\n请改进后重新提交。`;
      case 'step_advanced':
        return `✅ 已进入步骤 ${context.currentStep}：**${context.stepName}**`;
      case 'final_output_ready':
        return '🎉 所有步骤已完成！是否生成最终输出（论文/报告）？回复"是"或"否"。';
      case 'final_output_generated':
        return context.downloadUrl
          ? `✅ 报告已生成！[下载](${context.downloadUrl})`
          : '✅ 报告已生成！';
      case 'task_list':
        return context.tasks && context.tasks.length > 0
          ? `📋 **活跃任务**\n\n${context.tasks.map((t, i) => `${i + 1}. ${t.taskName} (${t.status})`).join('\n')}`
          : '暂无活跃任务。发送新任务开始。';
      case 'no_active_task':
        return '暂无进行中的 SOP 流程。发送新任务开始。';
      default:
        return '处理中...';
    }
  }

  // English fallback
  switch (context.type) {
    case 'cancelled':
      return '✅ SOP workflow cancelled. Send a new task to start over.';
    case 'paused':
      return `⏸️ SOP workflow paused. Progress: Step ${context.currentStep}/${context.totalSteps}. Send "continue" to resume.`;
    case 'resumed':
      return `🔄 SOP workflow resumed. Current step: ${context.currentStep}/${context.totalSteps}`;
    case 'restarted':
      return `🔄 Step ${context.currentStep} restarted.`;
    case 'completed':
      return '🎉 All steps completed! Would you like to generate a final output (paper/report)? Reply "yes" or "no".';
    case 'purpose_selection':
      return `Detected academic task: **${context.taskName}**\n\nPlease select your research purpose:\n\n1. **Write Paper** - For publication/thesis\n2. **Do Research** - Scientific research, experiments, analysis\n3. **Learning** - Learn about a specific field\n\nReply with a number or describe your purpose.`;
    case 'breakdown_confirm':
      return 'Please reply "confirm" to start execution, or provide modifications.';
    case 'step_submitted':
      return `Step completed. Reply "confirm" to proceed to the next step, or provide modifications.`;
    case 'step_rejected':
      return `❌ Review failed: ${context.reason}\n\nPlease resubmit with improvements.`;
    case 'step_advanced':
      return `✅ Moved to step ${context.currentStep}: **${context.stepName}**`;
    case 'final_output_ready':
      return '🎉 All steps completed! Would you like to generate a final output (paper/report)? Reply "yes" or "no".';
    case 'final_output_generated':
      return context.downloadUrl
        ? `✅ Report generated! [Download](${context.downloadUrl})`
        : '✅ Report generated!';
    case 'task_list':
      return context.tasks && context.tasks.length > 0
        ? `📋 **Active Tasks**\n\n${context.tasks.map((t, i) => `${i + 1}. ${t.taskName} (${t.status})`).join('\n')}`
        : 'No active tasks. Send a new task to start.';
    case 'no_active_task':
      return 'No active SOP workflow. Send a new task to start.';
    default:
      return 'Processing...';
  }
}
