/**
 * MiniMax 语音工具
 * - list_voices: 查询可用音色ID
 * - voice_clone: 音色快速复刻
 * - voice_design: 音色设计
 * - delete_voice: 删除音色
 */
import { registerTool } from './executor.js';
import { getMinimaxApiKey, getOpenAIApiKey } from '../../services/settings-cache.js';

export function registerTools(): void {
  /**
   * 查询可用音色ID
   * POST https://api.minimaxi.com/v1/get_voice
   *
   * voice_type: system / voice_cloning / voice_generation / all
   */
  registerTool('list_voices', async (args) => {
    const apiKey = getMinimaxApiKey();
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
    const apiKey = getMinimaxApiKey();
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
    const apiKey = getMinimaxApiKey();
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
    const apiKey = getMinimaxApiKey();
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
}
