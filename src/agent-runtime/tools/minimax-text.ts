/**
 * MiniMax 文本与图片生成工具
 * - generate_image: 文生图 / 图生图
 * - vision: 视觉理解
 */
import { registerTool } from './executor.js';

export function registerTools(): void {
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

    if (style) body.style = style;
    if (aspect_ratio) {
      body.aspect_ratio = aspect_ratio;
    } else if (width && height) {
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
}
