/**
 * MiniMax 音乐生成工具
 * - generate_music: 音乐生成
 * - generate_music_cover: 音乐翻唱
 */
import { registerTool } from './executor.js';
import { getMinimaxApiKey, getOpenAIApiKey } from '../../services/settings-cache.js';

export function registerTools(): void {
  /**
   * MiniMax 音乐生成
   * POST https://api.minimaxi.com/v1/music_generation
   *
   * 模型: music-2.6 / music-2.6-free / music-2.5+ / music-2.5
   */
  registerTool('generate_music', async (args) => {
    const apiKey = getMinimaxApiKey();
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
   */
  registerTool('generate_music_cover', async (args) => {
    const apiKey = getMinimaxApiKey();
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
}
