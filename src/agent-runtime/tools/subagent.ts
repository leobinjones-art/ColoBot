/**
 * 子Agent工具
 */
import { registerTool } from './executor.js';

// 辅助函数

function estimateComplexity(task: string): number {
  const t = task.toLowerCase();
  let score = 1;
  // 关键词复杂度
  if (/分析|拆解|对比|评估|判断/i.test(t)) score = Math.max(score, 3);
  if (/代码|开发|实现|编写.*程序/i.test(t)) score = Math.max(score, 4);
  if (/研究|调研|全面.*分析/i.test(t)) score = Math.max(score, 5);
  // 任务长度
  if (task.length > 200) score = Math.max(score, 2);
  if (task.length > 500) score = Math.max(score, 3);
  // 多步骤
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
    recs.push({ tool: 'minimax_search', reason: 'MiniMax官方搜索，高质量结果' });
    recs.push({ tool: 'web_search', reason: '补充搜索更广泛来源' });
  }
  if (/图片|图像|画图|生成.*图/i.test(t)) {
    recs.push({ tool: 'generate_image', reason: '生成图片' });
  }
  if (/视频|生成.*视频/i.test(t)) {
    recs.push({ tool: 'generate_video', reason: '生成视频' });
  }
  if (/音乐|歌曲|音频/i.test(t)) {
    recs.push({ tool: 'generate_music', reason: '生成音乐' });
  }
  if (/语音|tts|合成.*声音/i.test(t)) {
    recs.push({ tool: 'speak', reason: '语音合成' });
  }
  if (/记忆|记住|存储/i.test(t)) {
    recs.push({ tool: 'add_memory', reason: '存储关键信息' });
    recs.push({ tool: 'search_memory', reason: '检索已有记忆' });
  }
  // 默认至少要有搜索
  if (recs.length === 0) {
    recs.push({ tool: 'search_memory', reason: '先搜索项目记忆' });
    recs.push({ tool: 'web_search', reason: '补充外部信息' });
  }
  return recs;
}

/**
 * 全部可用工具清单（供父Agent参考如何选）
 */
const ALL_TOOLS = [
  // 记忆
  'search_memory', 'add_memory', 'list_memory',
  // 搜索
  'web_search', 'image_search', 'video_search', 'minimax_search',
  // MiniMax 文本/图片
  'generate_image', 'vision',
  // MiniMax TTS
  'speak',
  // MiniMax 音乐
  'generate_music', 'generate_music_cover',
  // MiniMax 视频
  'generate_video', 'query_video_task',
  // MiniMax 文件
  'upload_file', 'list_files', 'retrieve_file', 'delete_file',
  // MiniMax 语音
  'list_voices', 'voice_clone', 'voice_design', 'delete_voice',
];

export function registerTools(): void {
  /**
   * config_subagent — 提供子Agent配置指导，不预设具体配置
   * 父Agent根据指导自行决定如何生成 soul_content / allowed_tools / ttl_ms
   */
  registerTool('config_subagent', async (args) => {
    const { task, parent_id } = args as { task: string; parent_id?: string };

    // 估算任务复杂度，决定 TTL
    const complexityScore = estimateComplexity(task);
    const ttlMs = Math.min(
      Math.max(60_000, complexityScore * 60_000),
      10 * 60 * 1000
    );

    // 推荐工具选择原则
    const recommendedTools = recommendTools(task);

    return {
      // 指导父Agent如何构建 soul_content
      soul_content_guide: {
        description: 'soul_content 是 JSON 对象，包含子Agent的角色设定',
        fields: {
          role: 'string — 子Agent的身份角色名，如"代码助手"',
          personality: 'string — 性格描述，影响回答风格',
          rules: 'string[] — 子Agent的行为规则',
          skills: 'string[] — 子Agent擅长的技能',
        },
        example: JSON.stringify({
          role: '代码助手',
          personality: '严谨高效，注重代码质量和可维护性',
          rules: ['写代码前先理解需求', '复杂逻辑添加注释', '优先使用标准库'],
          skills: ['代码生成', 'Bug修复', '代码审查'],
        }, null, 2),
      },
      // 可选工具清单
      available_tools: ALL_TOOLS,
      // 推荐工具及理由
      recommended_tools: recommendedTools,
      // TTL 建议
      ttl_ms: ttlMs,
      ttl_reason: `任务复杂度评分 ${complexityScore}/5，建议 TTL ${ttlMs / 1000}秒`,
      // 父Agent ID
      parent_id: parent_id || '__parent__',
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
