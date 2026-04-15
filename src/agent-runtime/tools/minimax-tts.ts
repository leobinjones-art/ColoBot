/**
 * MiniMax TTS HD 语音合成工具
 * - speak: 语音合成
 */
import { registerTool } from './executor.js';

export function registerTools(): void {
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
      if (speed !== undefined) (body.voice_setting as Record<string, unknown>).speed = speed;
      if (vol !== undefined) (body.voice_setting as Record<string, unknown>).vol = vol;
      if (pitch !== undefined) (body.voice_setting as Record<string, unknown>).pitch = pitch;
      if (emotion) (body.voice_setting as Record<string, unknown>).emotion = emotion;
    }

    if (audio_format || sample_rate || bitrate || channel) {
      body.audio_setting = {};
      if (audio_format) (body.audio_setting as Record<string, unknown>).format = audio_format;
      if (sample_rate) (body.audio_setting as Record<string, unknown>).sample_rate = sample_rate;
      if (bitrate) (body.audio_setting as Record<string, unknown>).bitrate = bitrate;
      if (channel) (body.audio_setting as Record<string, unknown>).channel = channel;
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

    const data = await res.json() as {
      data?: { audio?: string; subtitle_file?: string; status?: number };
      extra_info?: Record<string, unknown>;
      trace_id?: string;
      base_resp?: { status_code: number; status_msg: string };
    };

    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax TTS failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
    }

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
}
