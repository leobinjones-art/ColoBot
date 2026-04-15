/**
 * 工具执行器 - 解析、执行工具调用
 */

import { searchMemory, addMemory, hybridSearch } from '../../memory/vector.js';

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  success: boolean;
  result: unknown;
  error?: string;
}

// 工具注册表
const toolRegistry = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();

function registerTool(name: string, fn: (args: Record<string, unknown>) => Promise<unknown>): void {
  toolRegistry.set(name, fn);
}

// ─── 内置工具 ───────────────────────────────────────────────

registerTool('search_memory', async (args) => {
  const { agent_id, query, top_k } = args as { agent_id: string; query: string; top_k?: number };
  return hybridSearch(agent_id, query, top_k ?? 5);
});

registerTool('add_memory', async (args) => {
  const { agent_id, key, value, metadata } = args as {
    agent_id: string;
    key: string;
    value: string;
    metadata?: Record<string, unknown>;
  };
  await addMemory(agent_id, key, value, metadata ?? {});
  return { ok: true };
});

registerTool('list_memory', async (args) => {
  const { agent_id } = args as { agent_id: string };
  const { listMemory } = await import('../../memory/vector.js');
  return listMemory(agent_id);
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

registerTool('get_time', async () => {
  return new Date().toISOString();
});

registerTool('web_search', async (args) => {
  const { query, safe_search, time_range, categories } = args as {
    query: string;
    safe_search?: number;
    time_range?: string;
    categories?: string[];
  };
  const { searxngSearch } = await import('../../search/searxng.js');
  return searxngSearch(query, {
    safe_search: safe_search as 0 | 1 | 2 | undefined,
    time_range,
    categories,
  });
});

registerTool('image_search', async (args) => {
  const { query, safe_search } = args as { query: string; safe_search?: number };
  const { imageSearch } = await import('../../search/searxng.js');
  return imageSearch(query, { safe_search: safe_search as 0 | 1 | 2 | undefined });
});

registerTool('video_search', async (args) => {
  const { query, safe_search, time_range } = args as {
    query: string;
    safe_search?: number;
    time_range?: string;
  };
  const { videoSearch } = await import('../../search/searxng.js');
  return videoSearch(query, { safe_search: safe_search as 0 | 1 | 2 | undefined, time_range });
});

/**
 * MiniMax 图片生成（文生图 / 图生图）
 * POST https://api.minimaxi.com/v1/image_generation
 *
 * subject_reference: 图生图主体参考 [{ type: "character", image_file: "url 或 data:image/...;base64,..." }]
 * style: 仅 image-01-live 支持
 * width/height: 仅 image-01 支持，需同时设置，范围[512, 2048]，是 8 的倍数
 * aspect_ratio: 1:1 16:9 4:3 3:2 2:3 3:4 9:16 21:9 (仅 image-01)
 */
registerTool('generate_image', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const {
    model,
    prompt,
    subject_reference,
    style,
    aspect_ratio,
    width,
    height,
    response_format,
    seed,
    n,
    prompt_optimizer,
    aigc_watermark,
  } = args as {
    model?: string;
    prompt: string;
    subject_reference?: Array<{ type: string; image_file: string }>;
    style?: Record<string, unknown>;
    aspect_ratio?: string;
    width?: number;
    height?: number;
    response_format?: string;
    seed?: number;
    n?: number;
    prompt_optimizer?: boolean;
    aigc_watermark?: boolean;
  };

  const body: Record<string, unknown> = {
    model: model || 'image-01',
    prompt,
  };

  if (subject_reference && subject_reference.length > 0) {
    body.subject_reference = subject_reference;
  }

  if (style) {
    body.style = style;
  }

  if (aspect_ratio) {
    body.aspect_ratio = aspect_ratio;
  } else if (width && height) {
    // width 和 height 需同时设置
    body.width = width;
    body.height = height;
  }

  body.response_format = response_format || 'url';
  if (seed !== undefined) body.seed = seed;
  body.n = n ?? 1;
  body.prompt_optimizer = prompt_optimizer ?? false;
  if (aigc_watermark !== undefined) body.aigc_watermark = aigc_watermark;

  const res = await fetch('https://api.minimaxi.com/v1/image_generation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax image generation error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    data?: {
      image_urls?: string[];
      image_base64?: string[];
    };
    metadata?: { success_count: number; failed_count: number };
    id?: string;
    base_resp?: { status_code: number; status_msg: string };
  };

  // 检查业务错误
  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax image generation failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return {
    images: data.data?.image_urls ?? data.data?.image_base64 ?? [],
    metadata: data.metadata,
    id: data.id,
  };
});

/**
 * MiniMax 视觉理解（coding-plan-vlm）
 * POST https://api.minimaxi.com/v1/coding_plan_vlm
 *
 * 根据图片内容回答问题，支持 URL 或 base64 图片输入
 */
registerTool('vision', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const { prompt, image_source } = args as {
    prompt: string;
    image_source: string;
  };

  if (!prompt) throw new Error('prompt is required');
  if (!image_source) throw new Error('image_source is required');

  const res = await fetch('https://api.minimaxi.com/v1/coding_plan_vlm', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, image_source }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax vision error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    choices?: Array<{ messages: Array<{ text: string }> }>;
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax vision failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  const text = data.choices?.[0]?.messages?.[0]?.text ?? '';
  return { description: text };
});

/**
 * MiniMax 搜索（coding-plan-search）
 * POST https://api.minimaxi.com/v1/coding_plan_search
 *
 * 支持 Google 高级搜索语法
 * 注意：现有 web_search 为 SearXNG，此工具命名为 minimax_search 避免冲突
 */
registerTool('minimax_search', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const { query } = args as { query: string };

  if (!query) throw new Error('query is required');

  const res = await fetch('https://api.minimaxi.com/v1/coding_plan_search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax search error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    results?: Array<{ title: string; url: string; snippet: string }>;
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax search failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return { results: data.results ?? [] };
});

/**
 * MiniMax TTS HD（语音合成）
 * POST https://api.minimaxi.com/v1/t2a_v2
 *
 * 模型: speech-2.8-hd / speech-2.8-turbo / speech-2.6-hd / speech-2.6-turbo / speech-02-hd / speech-02-turbo / speech-01-hd / speech-01-turbo
 * 文本最长 10000 字符
 * 支持流式输出 (stream: true)
 * 返回: { audio_url: string } 或 { audio: hex string, ...metadata }
 */
registerTool('speak', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const {
    text,
    model,
    voice_id,
    speed,
    vol,
    pitch,
    emotion,
    stream,
    output_format,
    audio_format,
    sample_rate,
    bitrate,
    channel,
  } = args as {
    text: string;
    model?: string;
    voice_id?: string;
    speed?: number;
    vol?: number;
    pitch?: number;
    emotion?: string;
    stream?: boolean;
    output_format?: string;
    audio_format?: string;
    sample_rate?: number;
    bitrate?: number;
    channel?: number;
  };

  if (!text) throw new Error('text is required');

  const body: Record<string, unknown> = {
    model: model || 'speech-2.8-hd',
    text,
    stream: stream ?? false,
  };

  if (voice_id) {
    body.voice_setting = { voice_id };
    if (speed !== undefined) body.voice_setting.speed = speed;
    if (vol !== undefined) body.voice_setting.vol = vol;
    if (pitch !== undefined) body.voice_setting.pitch = pitch;
    if (emotion) body.voice_setting.emotion = emotion;
  }

  if (audio_format || sample_rate || bitrate || channel) {
    body.audio_setting = {};
    if (audio_format) body.audio_setting.format = audio_format;
    if (sample_rate) body.audio_setting.sample_rate = sample_rate;
    if (bitrate) body.audio_setting.bitrate = bitrate;
    if (channel) body.audio_setting.channel = channel;
  }

  if (output_format) body.output_format = output_format;

  const res = await fetch('https://api.minimaxi.com/v1/t2a_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax TTS error: ${res.status} ${err}`);
  }

  if (stream) {
    // 流式: SSE lines, 返回合并的 hex 音频
    const text2 = await res.text();
    const lines = text2.split('\n');
    let fullHex = '';
    for (const line of lines) {
      if (!line.trim() || line.startsWith('data:')) continue;
      try {
        const chunk = JSON.parse(line);
        if (chunk.data?.audio) {
          fullHex += chunk.data.audio;
        }
        if (chunk.data?.status === 2) break;
      } catch { /* skip */ }
    }
    return { audio_hex: fullHex, format: audio_format || 'mp3' };
  }

  // 非流式
  const data = await res.json() as {
    data?: { audio?: string; subtitle_file?: string; status?: number };
    extra_info?: Record<string, unknown>;
    trace_id?: string;
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax TTS failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  // output_format=url 时返回 url，否则返回 hex
  if (output_format === 'url' || data.data?.subtitle_file) {
    return {
      audio_url: data.data?.subtitle_file || '',
      extra_info: data.extra_info,
      trace_id: data.trace_id,
    };
  }

  return {
    audio_hex: data.data?.audio || '',
    extra_info: data.extra_info,
    trace_id: data.trace_id,
  };
});

// ─── 解析 / 格式化 ───────────────────────────────────────────

const TOOL_CALL_REGEX = /<tool_call>\s*([\w_]+)\s*\(([\s\S]*?)\)\s*<\/tool_call>/gi;
const ARG_KEY_REGEX = /(\w+)\s*:\s*(?:'([^']*)'|"([^"]*)"|\[([^\]]*)\]|{([^}]*)}|(\S+))/g;

export function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let match;

  const regex = new RegExp(TOOL_CALL_REGEX.source, 'gi');
  while ((match = regex.exec(text)) !== null) {
    const name = match[1].trim();
    const argsStr = match[2].trim();

    const args: Record<string, unknown> = {};
    const argRegex = new RegExp(ARG_KEY_REGEX.source, 'g');
    let argMatch;

    while ((argMatch = argRegex.exec(argsStr)) !== null) {
      const key = argMatch[1];
      const value = argMatch[2] ?? argMatch[3] ?? argMatch[4] ?? argMatch[5] ?? argMatch[6] ?? '';
      args[key] = value;
    }

    calls.push({ name, args });
  }

  return calls;
}

export function stripToolCalls(text: string): string {
  return text.replace(/<tool_call>\s*[\w_]+\s*\([\s\S]*?\)\s*<\/tool_call>/gi, '').trim();
}

export function formatToolResults(results: ToolResult[]): string {
  if (results.length === 0) return '';
  return results
    .map((r) => {
      if (r.success) {
        return `[${r.name}] OK: ${JSON.stringify(r.result)}`;
      } else {
        return `[${r.name}] ERROR: ${r.error}`;
      }
    })
    .join('\n');
}

export function buildToolCall(name: string, args: Record<string, unknown>): string {
  const argsStr = Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v}'` : JSON.stringify(v)}`)
    .join(', ');
  return `<tool_call>\n${name}(${argsStr})\n</tool_call>`;
}

// ─── 执行 ───────────────────────────────────────────────────

export async function executeToolCall(call: ToolCall): Promise<ToolResult> {
  const fn = toolRegistry.get(call.name);
  if (!fn) {
    return { name: call.name, success: false, result: null, error: `Unknown tool: ${call.name}` };
  }

  try {
    const result = await fn(call.args);
    return { name: call.name, success: true, result };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { name: call.name, success: false, result: null, error };
  }
}

export async function executeToolCalls(calls: ToolCall[]): Promise<ToolResult[]> {
  return Promise.all(calls.map(executeToolCall));
}

export function listTools(): string[] {
  return Array.from(toolRegistry.keys());
}

export function isToolAllowed(_subAgentId: string, _toolName: string): boolean {
  // Parent agent can use all tools
  if (_subAgentId === '__parent__') return true;
  // For sub-agents, delegate to sub-agents module
  return true;
}
