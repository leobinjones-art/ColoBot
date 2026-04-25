/**
 * AI 驱动的动态任务拆解
 *
 * 核心流程：
 * 1. 父 Agent 分析用户请求 → 判断需要什么工具/能力
 * 2. 动态创建子 Agent → 根据任务需求选择工具白名单
 * 3. 子 Agent 执行 → 完成具体任务（支持数据传递）
 * 4. 父 Agent 审核 → 整合结果展示给用户
 *
 * 改进点：
 * - 子任务间数据传递
 * - 无依赖子任务并行执行
 * - 工具定义外部化
 */

import type { LLMProvider, AuditLogger } from '../runtime/types.js';
import type { LLMMessage } from '@colobot/types';
import {
  spawnSubAgent,
  getSubAgent,
  destroySubAgent,
  runSubAgentTask,
  listSubAgents,
  getGlobalAllowedTools,
  type SubAgent,
  type SubAgentDeps,
} from '../subagents/index.js';

// ── 工具定义 ──────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  capabilities: string[]; // 该工具能提供的能力
}

// 默认工具定义（可被外部覆盖）
export const DEFAULT_TOOLS: ToolDefinition[] = [
  { name: 'web_search', description: '网络搜索', capabilities: ['搜索', '查询', '查找', '天气', '新闻', '实时'] },
  { name: 'read_file', description: '读取文件', capabilities: ['读取', '文件', '表格', 'CSV', 'Excel', 'JSON'] },
  { name: 'write_file', description: '写入文件', capabilities: ['保存', '写入', '导出', '生成文件'] },
  { name: 'python', description: 'Python执行', capabilities: ['计算', '分析', '统计', '数据处理', '可视化'] },
  { name: 'database', description: '数据库操作', capabilities: ['查询', '存储', '数据库', 'SQL'] },
  { name: 'http', description: 'HTTP请求', capabilities: ['API', '请求', '调用', '接口'] },
  { name: 'chart', description: '图表生成', capabilities: ['图表', '可视化', '绘图', '展示'] },
];

// ── 任务分析结果 ──────────────────────────────────────────────

export interface TaskAnalysis {
  taskType: string;           // 任务类型：查询/分析/生成/处理
  description: string;        // 任务描述
  requiredTools: string[];    // 需要的工具
  reasoning: string;          // AI 的分析推理
  subTasks: SubTask[];        // 子任务列表
}

export interface SubTask {
  name: string;
  description: string;
  tools: string[];            // 该子任务需要的工具
  dependencies?: string[];    // 依赖的其他子任务
  inputFromDeps?: string[];   // 需要从哪些依赖获取输入
}

// ── 执行结果 ──────────────────────────────────────────────

export interface ExecutionResult {
  success: boolean;
  output: string;
  data?: any;                 // 结构化数据，供后续子任务使用
  subAgentId: string;
  toolCalls: { tool: string; args: any; result: any }[];
}

export interface TaskResult {
  taskId: string;
  analysis: TaskAnalysis;
  results: Map<string, ExecutionResult>;
  finalOutput: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
}

// ── 执行上下文（子任务间数据传递） ──────────────────────────────────────────────

export interface ExecutionContext {
  taskId: string;
  parentId: string;
  results: Map<string, ExecutionResult>;
  getDependencyOutput: (depName: string) => string | undefined;
  getDependencyData: (depName: string) => any | undefined;
}

// ── 依赖接口 ──────────────────────────────────────────────

export interface DynamicBreakdownDeps extends SubAgentDeps {
  tools?: ToolDefinition[];   // 自定义工具定义（外部注入）
  maxParallel?: number;       // 最大并行数，默认 3
  onAnalysis?: (analysis: TaskAnalysis) => Promise<void>;
  onSubTaskStart?: (subTask: SubTask, subAgentId: string, ctx: ExecutionContext) => Promise<void>;
  onSubTaskComplete?: (subTask: SubTask, result: ExecutionResult, ctx: ExecutionContext) => Promise<void>;
  onComplete?: (result: TaskResult) => Promise<void>;
}

// ── AI 分析提示词 ──────────────────────────────────────────────

const ANALYSIS_PROMPT = `你是一个任务分析专家。分析用户的请求，判断需要什么工具和能力。

可用工具：
{tools}

用户请求：
{request}

请返回 JSON 格式：
{
  "taskType": "查询|分析|生成|处理",
  "description": "任务描述",
  "requiredTools": ["tool1", "tool2"],
  "reasoning": "分析推理过程",
  "subTasks": [
    {
      "name": "子任务名称",
      "description": "具体描述",
      "tools": ["需要的工具"],
      "dependencies": ["依赖的其他子任务名称"],
      "inputFromDeps": ["需要从哪个依赖获取输入"]
    }
  ]
}

要求：
1. 根据请求内容选择合适的工具
2. 子任务应该独立可执行
3. 标明子任务之间的依赖关系
4. 如果后续子任务需要前面子任务的输出，在 inputFromDeps 中标明
5. 推理过程要清晰说明为什么需要这些工具`;

/**
 * 分析用户请求，判断需要什么工具
 */
export async function analyzeRequest(
  request: string,
  llm: LLMProvider,
  deps: DynamicBreakdownDeps
): Promise<TaskAnalysis> {
  const tools = deps.tools || DEFAULT_TOOLS;
  const toolsDesc = tools.map(t => `- ${t.name}: ${t.description} (能力: ${t.capabilities.join(', ')})`).join('\n');

  const prompt = ANALYSIS_PROMPT
    .replace('{tools}', toolsDesc)
    .replace('{request}', request.slice(0, 2000));

  const response = await llm.chat([
    { role: 'user', content: prompt }
  ], { maxTokens: 1000, temperature: 0.3 });

  const text = typeof response.content === 'string' ? response.content : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    // 默认分析：无法解析时返回基本分析
    return {
      taskType: '处理',
      description: request,
      requiredTools: ['read_file'],
      reasoning: '无法解析AI响应，使用默认工具',
      subTasks: [{ name: '执行任务', description: request, tools: ['read_file'] }],
    };
  }

  const parsed = JSON.parse(jsonMatch[0]);

  const analysis: TaskAnalysis = {
    taskType: parsed.taskType || '处理',
    description: parsed.description || request,
    requiredTools: parsed.requiredTools || [],
    reasoning: parsed.reasoning || '',
    subTasks: (parsed.subTasks || []).map((st: any) => ({
      name: st.name,
      description: st.description,
      tools: st.tools || [],
      dependencies: st.dependencies || [],
      inputFromDeps: st.inputFromDeps || [],
    })),
  };

  await deps.onAnalysis?.(analysis);
  return analysis;
}

/**
 * 构建子任务的提示词（包含依赖的输出）
 */
function buildSubTaskPrompt(
  subTask: SubTask,
  ctx: ExecutionContext
): string {
  let prompt = subTask.description;

  // 如果有依赖，将依赖的输出注入到提示词
  const depOutputs: string[] = [];
  for (const depName of subTask.inputFromDeps || []) {
    const output = ctx.getDependencyOutput(depName);
    if (output) {
      depOutputs.push(`【${depName}的结果】\n${output}`);
    }
  }

  if (depOutputs.length > 0) {
    prompt = `${subTask.description}\n\n前置任务结果：\n${depOutputs.join('\n\n')}`;
  }

  return prompt;
}

/**
 * 执行单个子任务
 */
async function executeSubTask(
  subTask: SubTask,
  ctx: ExecutionContext,
  llm: LLMProvider,
  deps: DynamicBreakdownDeps
): Promise<ExecutionResult> {
  // 过滤工具：只保留全局白名单中的工具
  const globalAllowed = getGlobalAllowedTools();
  const filteredTools = subTask.tools.filter(tool => globalAllowed.includes(tool));

  if (filteredTools.length === 0) {
    // 没有可用工具
    return {
      success: false,
      output: '没有可用的工具（所有工具都被全局白名单拦截）',
      subAgentId: '',
      toolCalls: [],
    };
  }

  // 创建子 Agent
  const subAgent = spawnSubAgent({
    name: subTask.name,
    soulContent: JSON.stringify({
      role: `子任务执行器: ${subTask.name}`,
      task: subTask.description,
    }),
    parentId: ctx.parentId,
    allowedTools: filteredTools,
  });

  await deps.onSubTaskStart?.(subTask, subAgent.id, ctx);

  try {
    // 构建包含依赖输出的提示词
    const prompt = buildSubTaskPrompt(subTask, ctx);

    // 执行子任务
    const output = await runSubAgentTask(subAgent, prompt, ctx.parentId, deps);

    const execResult: ExecutionResult = {
      success: true,
      output,
      subAgentId: subAgent.id,
      toolCalls: [],
    };

    ctx.results.set(subTask.name, execResult);
    await deps.onSubTaskComplete?.(subTask, execResult, ctx);

    return execResult;

  } catch (e) {
    const execResult: ExecutionResult = {
      success: false,
      output: '',
      subAgentId: subAgent.id,
      toolCalls: [],
    };

    ctx.results.set(subTask.name, execResult);
    await deps.onSubTaskComplete?.(subTask, execResult, ctx);

    throw e;
  }
}

/**
 * 执行动态任务拆解
 */
export async function executeDynamicTask(
  request: string,
  parentId: string,
  llm: LLMProvider,
  deps: DynamicBreakdownDeps
): Promise<TaskResult> {
  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const maxParallel = deps.maxParallel ?? 3;

  const result: TaskResult = {
    taskId,
    analysis: await analyzeRequest(request, llm, deps),
    results: new Map(),
    finalOutput: '',
    status: 'running',
    createdAt: Date.now(),
  };

  // 创建执行上下文
  const ctx: ExecutionContext = {
    taskId,
    parentId,
    results: result.results,
    getDependencyOutput: (depName: string) => result.results.get(depName)?.output,
    getDependencyData: (depName: string) => result.results.get(depName)?.data,
  };

  // 按依赖顺序执行子任务，支持并行
  const executed = new Set<string>();
  const failed = new Set<string>();

  while (executed.size + failed.size < result.analysis.subTasks.length) {
    // 找到可以执行的子任务（依赖已满足且未失败）
    const ready = result.analysis.subTasks.filter(st =>
      !executed.has(st.name) &&
      !failed.has(st.name) &&
      (st.dependencies || []).every(dep => executed.has(dep))
    );

    if (ready.length === 0) {
      // 检查是否有依赖失败导致无法继续
      const blocked = result.analysis.subTasks.filter(st =>
        !executed.has(st.name) &&
        !failed.has(st.name) &&
        (st.dependencies || []).some(dep => failed.has(dep))
      );

      if (blocked.length > 0) {
        // 标记为失败
        for (const st of blocked) {
          failed.add(st.name);
          result.results.set(st.name, {
            success: false,
            output: '依赖任务失败，无法执行',
            subAgentId: '',
            toolCalls: [],
          });
        }
        continue;
      }

      // 循环依赖
      result.status = 'failed';
      result.finalOutput = '任务执行失败：存在循环依赖或无法满足的依赖';
      break;
    }

    // 并行执行可执行的子任务（限制并发数）
    const batch = ready.slice(0, maxParallel);

    const batchResults = await Promise.allSettled(
      batch.map(subTask => executeSubTask(subTask, ctx, llm, deps))
    );

    for (let i = 0; i < batch.length; i++) {
      const subTask = batch[i];
      const batchResult = batchResults[i];

      if (batchResult.status === 'fulfilled') {
        executed.add(subTask.name);
      } else {
        failed.add(subTask.name);
        // 单个失败不中断整个任务，继续执行其他
      }
    }
  }

  // 汇总结果
  if (result.status === 'running') {
    result.status = failed.size > 0 ? 'failed' : 'completed';
    result.finalOutput = summarizeResults(result);
  }

  result.completedAt = Date.now();
  await deps.onComplete?.(result);

  return result;
}

/**
 * 汇总执行结果
 */
function summarizeResults(result: TaskResult): string {
  const lines: string[] = [
    `📋 **任务分析**: ${result.analysis.taskType}`,
    `📝 **描述**: ${result.analysis.description}`,
    `🤔 **推理**: ${result.analysis.reasoning}`,
    '',
    '---',
    '',
    '**执行结果:**',
    '',
  ];

  for (const subTask of result.analysis.subTasks) {
    const execResult = result.results.get(subTask.name);
    const icon = execResult?.success ? '✅' : '❌';

    lines.push(`${icon} **${subTask.name}**`);
    if (execResult?.output) {
      lines.push(`   ${execResult.output.slice(0, 200)}${execResult.output.length > 200 ? '...' : ''}`);
    }
    lines.push('');
  }

  const successCount = Array.from(result.results.values()).filter(r => r.success).length;
  lines.push(`---`);
  lines.push(`完成: ${successCount}/${result.analysis.subTasks.length}`);

  return lines.join('\n');
}

/**
 * 清理任务的子 Agent
 */
export function cleanupTaskResult(result: TaskResult, parentId: string): void {
  for (const execResult of result.results.values()) {
    if (execResult.subAgentId) {
      destroySubAgent(execResult.subAgentId, parentId);
    }
  }
}

// ── 导出旧接口兼容 ──────────────────────────────────────────────

export { TaskAnalysis as TaskBreakdown, DynamicBreakdownDeps as TaskBreakdownDeps };
export { executeDynamicTask as breakdownTask };
