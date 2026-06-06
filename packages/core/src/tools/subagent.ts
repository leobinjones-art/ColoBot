/**
 * 子 Agent 工具
 */

import * as path from 'path'
import type { ToolContext, LLMMessage } from '@colomind/types'
import { toolRegistry } from './registry.js'
import {
  spawnSubAgent,
  getSubAgent,
  destroySubAgent,
  isToolAllowed,
} from '../subagents/index.js'
import { chatWithConfig, type LLMConfig } from '../llm/index.js'
import { Logger } from '../logger.js'

// 子 Agent 日志器 - 写入单独的日志文件
const logger = new Logger({
  file: path.join(process.env.HOME || '', '.colomind', 'logs', 'subagent.log'),
  prefix: 'subagent',
  level: (process.env.COLOMIND_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
})

const ALL_TOOLS = [
  'search_memory',
  'add_memory',
  'list_memory',
  'web_search',
  'image_search',
  'video_search',
  'academic_search',
  'read_file',
  'write_file',
  'list_dir',
  'delete_file',
  'add_knowledge',
  'search_knowledge',
  'list_knowledge',
]

function estimateComplexity(task: string): number {
  const t = task.toLowerCase()
  let score = 1
  if (/分析|拆解|对比|评估|判断/i.test(t)) score = Math.max(score, 3)
  if (/代码|开发|实现|编写.*程序/i.test(t)) score = Math.max(score, 4)
  if (/研究|调研|全面.*分析/i.test(t)) score = Math.max(score, 5)
  if (task.length > 200) score = Math.max(score, 2)
  if (task.length > 500) score = Math.max(score, 3)
  if (/先|然后|接着|最后|首先|其次/i.test(t)) score = Math.max(score, 3)
  return Math.min(score, 5)
}

function recommendTools(task: string): Array<{ tool: string; reason: string }> {
  const t = task.toLowerCase()
  const recs: Array<{ tool: string; reason: string }> = []

  if (/代码|开发|函数|class|bug|调试/i.test(t)) {
    recs.push({ tool: 'search_memory', reason: '搜索项目记忆中的相关代码' })
    recs.push({ tool: 'web_search', reason: '查找技术实现方案' })
  }
  if (/搜索|查找|调研|确认.*信息/i.test(t)) {
    recs.push({ tool: 'web_search', reason: '搜索网络信息' })
  }
  if (/记忆|记住|存储/i.test(t)) {
    recs.push({ tool: 'add_memory', reason: '存储关键信息' })
    recs.push({ tool: 'search_memory', reason: '检索已有记忆' })
  }
  if (recs.length === 0) {
    recs.push({ tool: 'search_memory', reason: '先搜索项目记忆' })
    recs.push({ tool: 'web_search', reason: '补充外部信息' })
  }
  return recs
}

async function summarizeSubAgentResult(
  subAgentName: string,
  task: string,
  rawResult: string,
  config?: LLMConfig,
): Promise<string> {
  const prompt = `你是父Agent，负责整理汇总子Agent"${subAgentName}"的工作成果。

子Agent执行的任务：
"""
${task.slice(0, 2000)}
"""

子Agent原始输出：
"""
${rawResult.slice(0, 16000)}
"""

请整理汇总以上内容，要求：
1. 全面汇总工作成果，不要遗漏关键信息
2. 如果是搜索结果，保留所有有价值的条目和摘要
3. 如果是文献列表，整理成规范格式
4. 如果是分析结果，保留完整推理链和关键结论
5. 如果是代码相关，保留核心代码片段和解释
6. 去除格式噪音，但保留所有实质内容

直接输出整理后的内容，不要添加"以下是整理结果"等前缀。`

  try {
    if (!config) return rawResult
    const response = await chatWithConfig([{ role: 'user', content: prompt }], config, {
      maxTokens: 8000,
      temperature: 0.3,
    })
    return typeof response.content === 'string' ? response.content : rawResult
  } catch (e) {
    console.error('[SubAgent] Summarize failed:', e)
    return rawResult
  }
}

async function configSubagent(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const { task, parent_id } = args as { task: string; parent_id?: string }

  const complexityScore = estimateComplexity(task)
  const ttlMs = Math.min(Math.max(60_000, complexityScore * 60_000), 10 * 60 * 1000)
  const recommendedTools = recommendTools(task)

  return JSON.stringify(
    {
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
    },
    null,
    2,
  )
}

async function spawnSubagentTool(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const { name, soul_content, parent_id, ttl_ms, allowed_tools, fallback_model_id } = args as {
    name: string
    soul_content: string
    parent_id: string
    ttl_ms?: number
    allowed_tools?: string[]
    fallback_model_id?: string
  }

  logger.info('SPAWN', { name, parentId: parent_id || ctx.agentId, ttl_ms, allowed_tools })

  const agent = spawnSubAgent({
    name,
    soulContent: soul_content,
    parentId: parent_id || ctx.agentId,
    ttlMs: ttl_ms,
    allowedTools: allowed_tools,
    fallbackModelId: fallback_model_id,
  })

  logger.info('SPAWNED', { id: agent.id, name: agent.name })

  return JSON.stringify({ id: agent.id, name: agent.name }, null, 2)
}

async function delegateTask(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const { sub_agent_id, task } = args as { sub_agent_id: string; task: string }

  const agent = getSubAgent(sub_agent_id)
  if (!agent) {
    logger.error('DELEGATE_NOT_FOUND', { sub_agent_id })
    throw new Error(`SubAgent not found: ${sub_agent_id}`)
  }

  logger.info('DELEGATE_START', { sub_agent_id, name: agent.name, taskLength: task.length })

  const llmConfig = ctx.llmConfig
  if (!llmConfig) {
    logger.error('DELEGATE_NO_LLM_CONFIG', { sub_agent_id })
    throw new Error('No LLM config available in context — cannot run subagent')
  }

  const config: LLMConfig = llmConfig

  // Build tool definitions for native tool_use
  const toolDefs = agent.allowedTools
    .map(name => toolRegistry.get(name))
    .filter(Boolean)
    .map(t => ({
      name: t!.name,
      description: t!.description,
      parameters: t!.parameters as Record<string, unknown>,
    }))

  // Build system prompt from soul content
  const soul = JSON.parse(agent.soulContent || '{}')
  const systemParts: string[] = [`你是 ${soul.role || '助手'}。`]
  if (soul.personality) systemParts.push(`\n## 性格\n${soul.personality}`)
  if (soul.rules?.length) systemParts.push(`\n## 规则\n${soul.rules.map((r: string) => `- ${r}`).join('\n')}`)
  if (soul.skills?.length) systemParts.push(`\n## 技能\n${soul.skills.map((s: string) => `- ${s}`).join('\n')}`)
  const systemPrompt = systemParts.join('\n')

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task },
  ]

  const maxRounds = 5
  const timeoutMs = agent.taskTimeoutMs ?? 5 * 60 * 1000
  let finalContent = ''

  try {
    for (let round = 0; round < maxRounds; round++) {
      const response = await Promise.race([
        chatWithConfig(messages, config, { maxTokens: 2048, temperature: 0.7, tools: toolDefs }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM调用超时')), timeoutMs),
        ),
      ])

      // Native tool_use: execute tool calls and feed results back
      if (response.toolCalls && response.toolCalls.length > 0) {
        messages.push({ role: 'assistant', content: response.content || '' })

        const toolResults: Array<{ name: string; result?: string; error?: string }> = []
        for (const tc of response.toolCalls) {
          if (!isToolAllowed(sub_agent_id, tc.name)) {
            toolResults.push({ name: tc.name, error: 'Tool not allowed' })
            continue
          }
          try {
            const tool = toolRegistry.get(tc.name)
            if (!tool) {
              toolResults.push({ name: tc.name, error: `Tool not found: ${tc.name}` })
              continue
            }
            logger.debug('TOOL_EXECUTE', { sub_agent_id, tool: tc.name })
            const result = await tool.execute(
              { ...tc.args, sub_agent_id },
              { agentId: sub_agent_id, sessionKey: '', llmConfig: config },
            )
            toolResults.push({
              name: tc.name,
              result: typeof result === 'string' ? result : JSON.stringify(result),
            })
          } catch (e) {
            logger.error('TOOL_ERROR', { sub_agent_id, tool: tc.name, error: String(e) })
            toolResults.push({ name: tc.name, error: String(e) })
          }
        }

        const resultsText = toolResults
          .map(r => r.error ? `[${r.name}] ERROR: ${r.error}` : `[${r.name}] ${r.result?.slice(0, 2000)}`)
          .join('\n')
        messages.push({ role: 'user', content: resultsText })
        finalContent = typeof response.content === 'string' ? response.content : ''
        continue
      }

      // No tool calls — final response
      finalContent = typeof response.content === 'string' ? response.content : ''
      break
    }

    const summarizedResult = await summarizeSubAgentResult(agent.name, task, finalContent, config)
    logger.info('DELEGATE_DONE', {
      sub_agent_id,
      name: agent.name,
      resultLength: summarizedResult.length,
    })
    return summarizedResult
  } catch (e) {
    logger.error('DELEGATE_ERROR', { sub_agent_id, error: String(e) })
    throw e
  }
}

async function destroySubagentTool(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  const { sub_agent_id } = args as { sub_agent_id: string }

  const agent = getSubAgent(sub_agent_id)
  if (!agent) {
    logger.error('DESTROY_NOT_FOUND', { sub_agent_id })
    throw new Error(`SubAgent not found: ${sub_agent_id}`)
  }

  logger.info('DESTROY', { sub_agent_id, name: agent.name })
  destroySubAgent(sub_agent_id, agent.parentId)
  return JSON.stringify({ ok: true, destroyed: sub_agent_id })
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
  })

  toolRegistry.register({
    name: 'spawn_subagent',
    description: 'Create a new sub-agent with specified configuration',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Sub-agent name' },
        soul_content: {
          type: 'string',
          description: 'JSON string containing role, personality, rules, skills',
        },
        parent_id: { type: 'string', description: 'Parent agent ID' },
        ttl_ms: { type: 'number', description: 'Time-to-live in milliseconds' },
        allowed_tools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Allowed tools for this sub-agent',
        },
        fallback_model_id: { type: 'string', description: 'Fallback model ID' },
      },
      required: ['name', 'soul_content'],
    },
    execute: spawnSubagentTool,
  })

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
  })

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
  })
}
