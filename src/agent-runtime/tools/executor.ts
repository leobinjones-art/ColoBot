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
 * POST https://api.minimaxi.com/v1/coding_plan/vlm
 *
 * 根据图片内容回答问题，支持 URL 或 base64 图片输入
 */
registerTool('vision', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const { prompt, image_url, file_id } = args as {
    prompt?: string;
    image_url?: string;
    file_id?: string;
  };

  if (!prompt) throw new Error('prompt is required');
  if (!image_url && !file_id) throw new Error('image_url or file_id is required');

  const body: Record<string, unknown> = { prompt };
  if (file_id) {
    body.file_id = file_id;
  } else if (image_url) {
    body.image_url = image_url;
  }

  const res = await fetch('https://api.minimaxi.com/v1/coding_plan/vlm', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax vision error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    content?: string;
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax vision failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return { description: data.content ?? '' };
});

/**
 * MiniMax 搜索（coding-plan-search）
 * POST https://api.minimaxi.com/v1/coding_plan/search
 *
 * 支持 Google 高级搜索语法
 * 注意：现有 web_search 为 SearXNG，此工具命名为 minimax_search 避免冲突
 */
registerTool('minimax_search', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const { q } = args as { q: string };

  if (!q) throw new Error('q (query) is required');

  const res = await fetch('https://api.minimaxi.com/v1/coding_plan/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax search error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    organic?: Array<{ title: string; link: string; snippet: string; date?: string }>;
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax search failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return {
    results: (data.organic ?? []).map(r => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      date: r.date,
    })),
  };
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

/**
 * MiniMax 音乐生成
 * POST https://api.minimaxi.com/v1/music_generation
 *
 * 模型: music-2.6 / music-2.6-free / music-2.5+ / music-2.5
 * 支持: lyrics / instrumental / lyrics_optimizer
 */
registerTool('generate_music', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const {
    prompt,
    lyrics,
    model,
    instrumental,
    lyrics_optimizer,
    vocals,
    genre,
    mood,
    instruments,
    tempo,
    bpm,
    key,
    output_format,
  } = args as {
    prompt: string;
    lyrics?: string;
    model?: string;
    instrumental?: boolean;
    lyrics_optimizer?: boolean;
    vocals?: string;
    genre?: string;
    mood?: string;
    instruments?: string;
    tempo?: string;
    bpm?: number;
    key?: string;
    output_format?: string;
  };

  if (!prompt) throw new Error('prompt is required');

  const body: Record<string, unknown> = {
    model: model || 'music-2.6-free',
    prompt,
  };

  if (lyrics) body.lyrics = lyrics;
  if (instrumental) body.instrumental = true;
  if (lyrics_optimizer) body.lyrics_optimizer = true;
  if (vocals) body.vocals = vocals;
  if (genre) body.genre = genre;
  if (mood) body.mood = mood;
  if (instruments) body.instruments = instruments;
  if (tempo) body.tempo = tempo;
  if (bpm) body.bpm = bpm;
  if (key) body.key = key;
  if (output_format) body.output_format = output_format;

  const res = await fetch('https://api.minimaxi.com/v1/music_generation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax music generation error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    data?: { audio_url?: string; audio_hex?: string };
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax music failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return {
    audio_url: data.data?.audio_url || '',
    audio_hex: data.data?.audio_hex || '',
  };
});

/**
 * MiniMax 音乐翻唱（参考音频生成翻唱版）
 * POST https://api.minimaxi.com/v1/music_cover
 *
 * 模型: music-cover / music-cover-free
 * 参考音频: audio_url (公网URL) 或 audio_file (本地路径暂不支持)
 */
registerTool('generate_music_cover', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const {
    prompt,
    audio_url,
    lyrics,
    model,
    seed,
    output_format,
  } = args as {
    prompt: string;
    audio_url: string;
    lyrics?: string;
    model?: string;
    seed?: number;
    output_format?: string;
  };

  if (!prompt) throw new Error('prompt is required');
  if (!audio_url) throw new Error('audio_url is required');

  const body: Record<string, unknown> = {
    model: model || 'music-cover',
    prompt,
    audio_url,
  };

  if (lyrics) body.lyrics = lyrics;
  if (seed !== undefined) body.seed = seed;
  if (output_format) body.output_format = output_format;

  const res = await fetch('https://api.minimaxi.com/v1/music_cover', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax music cover error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    data?: { audio_url?: string; audio_hex?: string };
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax music cover failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return {
    audio_url: data.data?.audio_url || '',
    audio_hex: data.data?.audio_hex || '',
  };
});

/**
 * MiniMax 视频生成（异步，需轮询）
 * POST https://api.minimaxi.com/v1/video_generation
 *
 * 模型: MiniMax-Hailuo-2.3 (默认) / MiniMax-Hailuo-02 / S2V-01 / I2V-01 等
 * 支持: 文生视频(T2V) / 图生视频(I2V) / 首尾帧插值(S2V)
 *
 * 注意: 此工具会轮询直到完成，最长等待 5 分钟
 */
registerTool('generate_video', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const {
    prompt,
    model,
    first_frame_image,
    last_frame_image,
    subject_image,
  } = args as {
    prompt: string;
    model?: string;
    first_frame_image?: string;
    last_frame_image?: string;
    subject_image?: string;
  };

  if (!prompt) throw new Error('prompt is required');

  // 确定模型
  let actualModel = model || 'MiniMax-Hailuo-2.3';
  if (!model) {
    if (last_frame_image) actualModel = 'MiniMax-Hailuo-02';
    else if (subject_image) actualModel = 'S2V-01';
  }

  const body: Record<string, unknown> = {
    model: actualModel,
    prompt,
  };

  if (first_frame_image) body.first_frame_image = first_frame_image;
  if (last_frame_image) body.last_frame_image = last_frame_image;
  if (subject_image) {
    body.subject_reference = [{ type: 'character', image: [subject_image] }];
  }

  // 1. 创建任务
  const createRes = await fetch('https://api.minimaxi.com/v1/video_generation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`MiniMax video generation error: ${createRes.status} ${err}`);
  }

  const createData = await createRes.json() as {
    task_id?: string;
    status?: string;
    base_resp?: { status_code: number; status_msg: string };
  };

  if (createData.base_resp && createData.base_resp.status_code !== 0) {
    throw new Error(`MiniMax video task creation failed: ${createData.base_resp.status_code} ${createData.base_resp.status_msg}`);
  }

  const taskId = createData.task_id;
  if (!taskId) throw new Error('No task_id returned');

  // 2. 轮询直到完成
  const maxWaitMs = 5 * 60 * 1000; // 5 分钟
  const pollIntervalMs = 5000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollIntervalMs));

    const statusRes = await fetch(
      `https://api.minimaxi.com/v1/query/video_generation?task_id=${taskId}`,
      {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }
    );

    if (!statusRes.ok) {
      const err = await statusRes.text();
      throw new Error(`MiniMax video status error: ${statusRes.status} ${err}`);
    }

    const statusData = await statusRes.json() as {
      status?: string;
      file_id?: string;
      video_url?: string;
      base_resp?: { status_code: number; status_msg: string };
    };

    if (statusData.status === 'success' && statusData.file_id) {
      // 3. 获取下载链接
      const fileRes = await fetch(
        `https://api.minimaxi.com/v1/files/retrieve?file_id=${statusData.file_id}`,
        {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        }
      );

      if (fileRes.ok) {
        const fileData = await fileRes.json() as {
          file?: { download_url?: string };
        };
        return {
          task_id: taskId,
          status: 'success',
          video_url: fileData.file?.download_url || '',
        };
      }
      return {
        task_id: taskId,
        status: 'success',
        file_id: statusData.file_id,
      };
    }

    if (statusData.status === 'fail' || statusData.status === 'failed') {
      throw new Error(`MiniMax video generation failed: ${statusData.base_resp?.status_msg || statusData.status}`);
    }
  }

  throw new Error(`Video generation timed out after 5 minutes. task_id: ${taskId}`);
});

/**
 * MiniMax 查询视频任务状态
 * GET https://api.minimaxi.com/v1/query/video_generation?task_id=xxx
 *
 * 在 generate_video 超过 5 分钟超时时，可用此工具主动查询
 */
registerTool('query_video_task', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const { task_id } = args as { task_id: string };
  if (!task_id) throw new Error('task_id is required');

  const res = await fetch(
    `https://api.minimaxi.com/v1/query/video_generation?task_id=${task_id}`,
    {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax video status error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    task_id?: string;
    status?: string;
    file_id?: string;
    video_url?: string;
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax video query failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  if (data.status === 'success' && data.file_id) {
    // 尝试获取下载链接
    const fileRes = await fetch(
      `https://api.minimaxi.com/v1/files/retrieve?file_id=${data.file_id}`,
      {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }
    );
    if (fileRes.ok) {
      const fileData = await fileRes.json() as {
        file?: { download_url?: string };
      };
      return {
        task_id: data.task_id,
        status: 'success',
        video_url: fileData.file?.download_url || '',
        file_id: data.file_id,
      };
    }
    return { task_id: task_id, status: data.status, file_id: data.file_id };
  }

  return { task_id: task_id, status: data.status };
});

// ─── MiniMax 文件管理 ─────────────────────────────────────────

/**
 * MiniMax 文件上传
 * POST https://api.minimaxi.com/v1/files/upload
 *
 * purpose: voice_clone / prompt_audio / t2a_async_input / video_generation
 * 支持 mp3, m4a, wav, text, zip, 图片格式
 */
registerTool('upload_file', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const { file_url, file_data, purpose } = args as {
    file_url?: string;
    file_data?: string; // base64 文件数据
    purpose: string;
  };

  if (!purpose) throw new Error('purpose is required (voice_clone/prompt_audio/t2a_async_input/video_generation)');
  if (!file_url && !file_data) throw new Error('file_url or file_data (base64) is required');

  let fileBuffer: ArrayBuffer;

  if (file_data) {
    // base64 解码
    const binaryString = atob(file_data.replace(/\s/g, ''));
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    fileBuffer = bytes.buffer;
  } else if (file_url) {
    // 从 URL 下载
    const res = await fetch(file_url);
    if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
    fileBuffer = await res.arrayBuffer();
  } else {
    throw new Error('No file source provided');
  }

  const formData = new FormData();
  const blob = new Blob([fileBuffer]);
  formData.append('file', blob, 'file');
  formData.append('purpose', purpose);

  const res = await fetch('https://api.minimaxi.com/v1/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax file upload error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    file?: {
      file_id: string;
      bytes: number;
      created_at: number;
      filename: string;
      purpose: string;
    };
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax file upload failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return {
    file_id: data.file?.file_id,
    bytes: data.file?.bytes,
    filename: data.file?.filename,
    purpose: data.file?.purpose,
    created_at: data.file?.created_at,
  };
});

/**
 * MiniMax 文件列表
 * GET https://api.minimaxi.com/v1/files/list?purpose=xxx
 *
 * purpose: voice_clone / prompt_audio / t2a_async_input
 */
registerTool('list_files', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const { purpose } = args as { purpose?: string };

  const url = purpose
    ? `https://api.minimaxi.com/v1/files/list?purpose=${encodeURIComponent(purpose)}`
    : 'https://api.minimaxi.com/v1/files/list';

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax file list error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    files?: Array<{
      file_id: string;
      bytes: number;
      created_at: number;
      filename: string;
      purpose: string;
    }>;
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax file list failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return {
    files: (data.files ?? []).map(f => ({
      file_id: f.file_id,
      bytes: f.bytes,
      filename: f.filename,
      purpose: f.purpose,
      created_at: new Date(f.created_at * 1000).toISOString(),
    })),
  };
});

/**
 * MiniMax 文件检索（查询文件信息 + 下载链接）
 * GET https://api.minimaxi.com/v1/files/retrieve?file_id=xxx
 */
registerTool('retrieve_file', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const { file_id } = args as { file_id: string };
  if (!file_id) throw new Error('file_id is required');

  const res = await fetch(
    `https://api.minimaxi.com/v1/files/retrieve?file_id=${encodeURIComponent(file_id)}`,
    { headers: { 'Authorization': `Bearer ${apiKey}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax file retrieve error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    file?: {
      file_id: string;
      bytes: number;
      created_at: number;
      filename: string;
      purpose: string;
      download_url?: string;
    };
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax file retrieve failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return {
    file_id: data.file?.file_id,
    bytes: data.file?.bytes,
    filename: data.file?.filename,
    purpose: data.file?.purpose,
    download_url: data.file?.download_url,
    created_at: data.file?.created_at
      ? new Date(data.file.created_at * 1000).toISOString()
      : undefined,
  };
});

/**
 * MiniMax 文件删除
 * POST https://api.minimaxi.com/v1/files/delete
 *
 * purpose: voice_clone / prompt_audio / t2a_async / t2a_async_input / video_generation
 */
registerTool('delete_file', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const { file_id, purpose } = args as { file_id: string; purpose: string };
  if (!file_id) throw new Error('file_id is required');
  if (!purpose) throw new Error('purpose is required');

  const res = await fetch('https://api.minimaxi.com/v1/files/delete', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file_id, purpose }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax file delete error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    file_id?: string;
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax file delete failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return { file_id: data.file_id, deleted: true };
});

// ─── MiniMax 语音工具 ─────────────────────────────────────────

/**
 * 查询可用音色ID
 * POST https://api.minimaxi.com/v1/get_voice
 *
 * voice_type: system / voice_cloning / voice_generation / all
 */
registerTool('list_voices', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const { voice_type = 'all' } = args as { voice_type?: string };

  const res = await fetch('https://api.minimaxi.com/v1/get_voice', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ voice_type }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax list voices error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    system_voice?: Array<{
      voice_id: string;
      voice_name?: string;
      description?: string[];
    }>;
    voice_cloning?: Array<{
      voice_id: string;
      voice_name?: string;
      created_at?: number;
    }>;
    voice_generation?: Array<{
      voice_id: string;
      voice_name?: string;
      created_at?: number;
    }>;
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax list voices failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return {
    system_voices: (data.system_voice ?? []).map(v => ({
      voice_id: v.voice_id,
      voice_name: v.voice_name,
      description: v.description?.join('; '),
    })),
    cloned_voices: (data.voice_cloning ?? []).map(v => ({
      voice_id: v.voice_id,
      voice_name: v.voice_name,
      created_at: v.created_at ? new Date(v.created_at * 1000).toISOString() : undefined,
    })),
    generated_voices: (data.voice_generation ?? []).map(v => ({
      voice_id: v.voice_id,
      voice_name: v.voice_name,
      created_at: v.created_at ? new Date(v.created_at * 1000).toISOString() : undefined,
    })),
  };
});

/**
 * 音色快速复刻
 * POST https://api.minimaxi.com/v1/voice_clone
 *
 * 复刻得到的音色若 7 天内未正式调用则会被删除
 */
registerTool('voice_clone', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const { file_id, voice_id, clone_prompt_file_id, text, model } = args as {
    file_id: string;
    voice_id: string;
    clone_prompt_file_id?: string;
    text?: string;
    model?: string;
  };

  if (!file_id) throw new Error('file_id is required (upload audio file first)');
  if (!voice_id) throw new Error('voice_id is required');

  const body: Record<string, unknown> = { file_id, voice_id };
  if (clone_prompt_file_id) {
    body.clone_prompt = { prompt_audio: clone_prompt_file_id };
  }
  if (text) {
    if (!model) throw new Error('model is required when text is provided');
    body.text = text;
    body.model = model;
  }

  const res = await fetch('https://api.minimaxi.com/v1/voice_clone', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax voice clone error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    voice_id?: string;
    trial_audio?: string;
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax voice clone failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return {
    voice_id: data.voice_id,
    trial_audio: data.trial_audio,
  };
});

/**
 * 音色设计（通过 prompt 生成音色）
 * POST https://api.minimaxi.com/v1/voice_design
 */
registerTool('voice_design', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const { prompt, preview_text, voice_id, aigc_watermark } = args as {
    prompt: string;
    preview_text: string;
    voice_id?: string;
    aigc_watermark?: boolean;
  };

  if (!prompt) throw new Error('prompt is required');
  if (!preview_text) throw new Error('preview_text is required');

  const body: Record<string, unknown> = { prompt, preview_text };
  if (voice_id) body.voice_id = voice_id;
  if (aigc_watermark) body.aigc_watermark = aigc_watermark;

  const res = await fetch('https://api.minimaxi.com/v1/voice_design', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax voice design error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    voice_id?: string;
    trial_audio?: string;
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax voice design failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return {
    voice_id: data.voice_id,
    trial_audio: data.trial_audio,
  };
});

/**
 * 删除音色
 * POST https://api.minimaxi.com/v1/delete_voice
 */
registerTool('delete_voice', async (args) => {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const { voice_id } = args as { voice_id: string };
  if (!voice_id) throw new Error('voice_id is required');

  const res = await fetch('https://api.minimaxi.com/v1/delete_voice', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ voice_id }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax delete voice error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    base_resp?: { status_code: number; status_msg: string };
  };

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax delete voice failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
  }

  return { voice_id, deleted: true };
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
