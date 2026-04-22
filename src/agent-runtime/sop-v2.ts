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
4. 步骤数量和内容完全根据任务需求和研究目的动态决定：
   - paper：文献调研→分析→撰写→投稿
   - research：问题定义→方法设计→实验/计算→结果分析
   - learning：基础概念→深入学习→实践应用
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
 */
export async function getActiveSopTask(agentId: string, sessionKey: string, includePaused = false): Promise<SopState | null> {
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
      // 只返回活跃状态的任务（或包含暂停状态）
      if (state && (state.status === 'active' || (includePaused && state.status === 'paused'))) {
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
 * 格式化 SOP 任务列表
 */
export function formatSopList(tasks: SopState[]): string {
  if (tasks.length === 0) {
    return '暂无进行中的 SOP 任务。\n\n发送新任务开始新流程。';
  }

  const lines: string[] = ['📋 **SOP 任务列表**\n'];
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const statusIcon = task.status === 'paused' ? '⏸️' : '🔄';
    lines.push(`${i + 1}. ${statusIcon} **${task.taskName}**`);
    lines.push(`   进度：${task.currentStep}/${task.steps.length} | 状态：${task.status === 'paused' ? '已暂停' : '进行中'}`);
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
    /继续sop/i, /恢复sop/i, /继续$/i, /恢复$/i, /resume/i,
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
