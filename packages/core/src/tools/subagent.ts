/**
 * 子 Agent 工具
 */

import type { ToolContext, LLMMessage } from '@colobot/types';
import { toolRegistry } from './registry.js';
import {
  spawnSubAgent,
  getSubAgent,
  runSubAgentTask,
  destroySubAgent,
} from '../subagents/index.js';
import { agentChat } from '../llm/index.js';

const ALL_TOOLS = [
  'search_memory', 'add_memory', 'list_memory',
  'web_search', 'image_search', 'video_search', 'academic_search',
  'read_file', 'write_file', 'list_dir', 'delete_file',
  'add_knowledge', 'search_knowledge', 'list_knowledge',
];

function estimateComplexity(task: string): number {
  const t = task.toLowerCase();
  let score = 1;
  if (/分析|拆解|对比|评估|判断/i.test(t)) score = Math.max(score, 3);
  if (/代码|开发|实现|编写.*程序/i.test(t)) score = Math.max(score, 4);
  if (/研究|调研|全面.*分析/i.test(t)) score = Math.max(score, 5);
  if (task.length > 200) score = Math.max(score, 2);
  if (task.length > 500) score = Math.max(score, 3);
  if (/先|然后|接着|最后|首先|其次/i.test(t)) score = Math.max(score, 3);
  return Math.min(score, 5);
}

function recommendTools(task: string): Array<{ tool: string; reason: string }> {
  const t = task.toLowerCase();
  const recs: Array<{ tool: string; reason: string }> = [];

  if (/代码|开发|函数|class|bug|调试/i.test(t)) {
    recs.push({ tool: 'search_memory', reason: '搜索项目记忆中的相关代码' });
    recs.push({ tool: 'web_search', reason: '查找技术实现方案' });
  }
  if (/搜索|查找|调研|确认.*信息/i.test(t)) {
    recs.push({ tool: 'web_search', reason: '搜索网络信息' });
  }
  if (/记忆|记住|存储/i.test(t)) {
    recs.push({ tool: 'add_memory', reason: '存储关键信息' });
    recs.push({ tool: 'search_memory', reason: '检索已有记忆' });
  }
  if (recs.length === 0) {
    recs.push({ tool: 'search_memory', reason: '先搜索项目记忆' });
    recs.push({ tool: 'web_search', reason: '补充外部信息' });
  }
  return recs;
}

async function summarizeSubAgentResult(
  subAgentName: string,
  task: string,
  rawResult: string
): Promise<string> {
  const prompt = `你是父Agent，负责整理汇总子Agent"${subAgentName}"的工作成果。

子Agent执行的任务：
"""
${task.slice(0, 1000)}
"""

子Agent原始输出：
"""
${rawResult.slice(0, 4000)}
"""

请整理汇总以上内容，要求：
1. 提取核心信息，去除冗余和格式噪音
2. 以专业、简洁的方式呈现
3. 如果是文献列表，整理成规范格式
4. 如果是分析结果，提炼关键结论
5. 控制在300-500字以内

直接输出整理后的内容，不要添加"以下是整理结果"等前缀。`;

  try {
    const response = await agentChat({ role: 'assistant' }, [{ role: 'user', content: prompt }], {
      maxTokens: 800,
      temperature: 0.3,
    });
    return typeof response.content === 'string' ? response.content : rawResult;
  } catch (e) {
    console.error('[SubAgent] Summarize failed:', e);
    return rawResult;
  }
}

async function configSubagent(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const { task, parent_id } = args as { task: string; parent_id?: string };

  const complexityScore = estimateComplexity(task);
  const ttlMs = Math.min(Math.max(60_000, complexityScore * 60_000), 10 * 60 * 1000);
  const recommendedTools = recommendTools(task);

  return JSON.stringify({
    soul_content_guide: {
      description: 'soul_content 是 JSON 对象，包含子Agent的角色设定',
      fields: {
        role: 'string — 子Agent的身份角色名',
        personality: 'string — 性格描述',
        rules: 'string[] — 行为规则',
        skills: 'string[] — 擅长的技能',
      },
      example: {
        role: '代码助手',
        personality: '严谨高效，注重代码质量',
        rules: ['写代码前先理解需求', '复杂逻辑添加注释'],
        skills: ['代码生成', 'Bug修复'],
      },
    },
    available_tools: ALL_TOOLS,
    recommended_tools: recommendedTools,
    ttl_ms: ttlMs,
    ttl_reason: `任务复杂度评分 ${complexityScore}/5，建议 TTL ${ttlMs / 1000}秒`,
    parent_id: parent_id || '__parent__',
  }, null, 2);
}

async function spawnSubagentTool(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const { name, soul_content, parent_id, ttl_ms, allowed_tools, fallback_model_id } = args as {
    name: string;
    soul_content: string;
    parent_id: string;
    ttl_ms?: number;
    allowed_tools?: string[];
    fallback_model_id?: string;
  };

  const agent = spawnSubAgent({
    name,
    soulContent: soul_content,
    parentId: parent_id || ctx.agentId,
    ttlMs: ttl_ms,
    allowedTools: allowed_tools,
    fallbackModelId: fallback_model_id,
  });

  return JSON.stringify({ id: agent.id, name: agent.name }, null, 2);
}

async function delegateTask(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const { sub_agent_id, task } = args as { sub_agent_id: string; task: string };

  const agent = getSubAgent(sub_agent_id);
  if (!agent) throw new Error(`SubAgent not found: ${sub_agent_id}`);

  // TODO: 需要传入 deps
  const rawResult = await runSubAgentTask(agent, task, agent.parentId, {} as any);
  const summarizedResult = await summarizeSubAgentResult(agent.name, task, rawResult);

  return summarizedResult;
}

async function destroySubagentTool(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const { sub_agent_id } = args as { sub_agent_id: string };

  const agent = getSubAgent(sub_agent_id);
  if (!agent) throw new Error(`SubAgent not found: ${sub_agent_id}`);

  destroySubAgent(sub_agent_id, agent.parentId);
  return JSON.stringify({ ok: true, destroyed: sub_agent_id });
}

export function registerSubagentTools(): void {
  toolRegistry.register({
    name: 'config_subagent',
    description: 'Get configuration guidance for creating a sub-agent',
    parameters: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task description for the sub-agent' },
        parent_id: { type: 'string', description: 'Parent agent ID' },
      },
      required: ['task'],
    },
    execute: configSubagent,
  });

  toolRegistry.register({
    name: 'spawn_subagent',
    description: 'Create a new sub-agent with specified configuration',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Sub-agent name' },
        soul_content: { type: 'string', description: 'JSON string containing role, personality, rules, skills' },
        parent_id: { type: 'string', description: 'Parent agent ID' },
        ttl_ms: { type: 'number', description: 'Time-to-live in milliseconds' },
        allowed_tools: { type: 'array', items: { type: 'string' }, description: 'Allowed tools for this sub-agent' },
        fallback_model_id: { type: 'string', description: 'Fallback model ID' },
      },
      required: ['name', 'soul_content'],
    },
    execute: spawnSubagentTool,
  });

  toolRegistry.register({
    name: 'delegate_task',
    description: 'Delegate a task to a sub-agent',
    parameters: {
      type: 'object',
      properties: {
        sub_agent_id: { type: 'string', description: 'Sub-agent ID to delegate to' },
        task: { type: 'string', description: 'Task description' },
      },
      required: ['sub_agent_id', 'task'],
    },
    execute: delegateTask,
  });

  toolRegistry.register({
    name: 'destroy_subagent',
    description: 'Destroy a sub-agent',
    parameters: {
      type: 'object',
      properties: {
        sub_agent_id: { type: 'string', description: 'Sub-agent ID to destroy' },
      },
      required: ['sub_agent_id'],
    },
    execute: destroySubagentTool,
  });
}
