/**
 * 子Agent工具
 */
import { registerTool } from './executor.js';

// 子Agent 模板库
const SUBAGENT_TEMPLATES: Record<string, {
  role: string;
  personality: string;
  rules: string[];
  skills: string[];
  allowedTools: string[];
  defaultTtlMs: number;
}> = {
  code: {
    role: '代码工程师',
    personality: '严谨、高效、追求最佳实践。遇到不确定的实现时主动搜索验证。',
    rules: [
      '写代码前先理解需求，明确输入输出',
      '代码要有注释，复杂逻辑要解释',
      '优先使用标准库和常用框架',
      '如果需要外部知识，先用搜索工具确认',
    ],
    skills: ['代码生成', '代码审查', 'Bug定位', '代码重构'],
    allowedTools: ['search_memory', 'web_search', 'minimax_search', 'list_memory', 'generate_image'],
    defaultTtlMs: 5 * 60 * 1000,
  },
  search: {
    role: '搜索分析师',
    personality: '细心、全面、注重信息准确性。善于交叉验证来源。',
    rules: [
      '先明确搜索关键词和范围',
      '多个来源交叉验证',
      '整理信息时标注来源',
      '结论要有依据，不猜测',
    ],
    skills: ['信息检索', '多源对比', '总结归纳', '结构化输出'],
    allowedTools: ['minimax_search', 'web_search', 'list_memory', 'search_memory'],
    defaultTtlMs: 3 * 60 * 1000,
  },
  writing: {
    role: '写作助手',
    personality: '流畅、富有创意。注重表达的清晰和吸引力。',
    rules: [
      '理解目标读者',
      '结构清晰，逻辑连贯',
      '语言简洁，避免冗余',
      '必要时可搜索参考案例',
    ],
    skills: ['文案写作', '文章润色', '结构优化', '风格把控'],
    allowedTools: ['search_memory', 'list_memory', 'web_search'],
    defaultTtlMs: 3 * 60 * 1000,
  },
  analysis: {
    role: '数据分析师',
    personality: '严谨、逻辑清晰。注重数据支撑和推理过程。',
    rules: [
      '先收集足够信息',
      '分析要有数据支撑',
      '结论要明确，保留推理过程',
      '不确定时如实说明',
    ],
    skills: ['数据分析', '图表生成建议', '逻辑推理', '总结报告'],
    allowedTools: ['search_memory', 'minimax_search', 'list_memory', 'generate_image'],
    defaultTtlMs: 5 * 60 * 1000,
  },
  general: {
    role: '通用助手',
    personality: '友好、灵活、乐于助人。',
    rules: [
      '尽力理解用户真实需求',
      '不确定时主动询问',
      '复杂任务主动拆解',
    ],
    skills: ['综合能力', '任务分解', '信息整理'],
    allowedTools: ['search_memory', 'add_memory', 'list_memory', 'web_search', 'minimax_search'],
    defaultTtlMs: 3 * 60 * 1000,
  },
};

function inferTaskType(task: string): string {
  const t = task.toLowerCase();
  if (/代码|编译|函数|class|import|def |function|=>|implement|write.*code|programming/i.test(t)) return 'code';
  if (/搜索|查找|调研|收集.*信息|查一下|多少钱|谁|什么.*最好/i.test(t)) return 'search';
  if (/写|文章|文案|报告|总结|润色|改写/i.test(t)) return 'writing';
  if (/分析|对比|评估|判断|拆解.*问题/i.test(t)) return 'analysis';
  return 'general';
}

export function registerTools(): void {
  /**
   * 根据任务描述，推荐子Agent配置
   */
  registerTool('config_subagent', async (args) => {
    const { task, task_type } = args as { task: string; task_type?: string };

    const type = task_type || inferTaskType(task);
    const template = SUBAGENT_TEMPLATES[type] || SUBAGENT_TEMPLATES.general;

    // 根据任务长度调整 TTL
    const estimatedMs = Math.max(
      template.defaultTtlMs,
      Math.min(task.length * 100, 10 * 60 * 1000)
    );

    const name = `${template.role}-${Date.now().toString(36).slice(-4)}`;
    const soul_content = JSON.stringify({
      role: template.role,
      personality: template.personality,
      rules: template.rules,
      skills: template.skills,
    });

    return {
      name,
      task_type: type,
      soul_content,
      allowed_tools: template.allowedTools,
      ttl_ms: estimatedMs,
      reason: `根据任务类型"${type}"生成：${template.skills.join('/')}，使用工具${template.allowedTools.join('/')}`,
    };
  });

  registerTool('delegate_task', async (args) => {
    const { sub_agent_id, task } = args as { sub_agent_id: string; task: string };
    const { runSubAgentTask, getSubAgent } = await import('../sub-agents.js');
    const agent = getSubAgent(sub_agent_id);
    if (!agent) throw new Error(`SubAgent not found: ${sub_agent_id}`);
    return runSubAgentTask(agent, task, agent.parentId);
  });

  registerTool('spawn_subagent', async (args) => {
    const { name, soul_content, parent_id, ttl_ms, allowed_tools } = args as {
      name: string;
      soul_content: string;
      parent_id: string;
      ttl_ms?: number;
      allowed_tools?: string[];
    };
    const { spawnSubAgent } = await import('../sub-agents.js');
    const agent = spawnSubAgent({
      name,
      soul_content,
      parentId: parent_id,
      ttlMs: ttl_ms,
      allowedTools: allowed_tools,
    });
    return { id: agent.id, name: agent.name };
  });
}
