/**
 * 向量嵌入 - OpenAI / MiniMax Embeddings
 */

import type { EmbedResult } from '@colobot/types';

export interface EmbeddingConfig {
  provider: 'openai' | 'minimax' | 'mock';
  openaiApiKey?: string;
  minimaxApiKey?: string;
  openaiModel?: string;
  minimaxModel?: string;
  openaiEndpoint?: string;
  minimaxEndpoint?: string;
}

let config: EmbeddingConfig = { provider: 'mock' };

/**
 * 配置嵌入服务
 */
export function configureEmbedding(c: Partial<EmbeddingConfig>): void {
  config = { ...config, ...c };
}

/**
 * 生成嵌入向量
 */
export async function embed(text: string): Promise<EmbedResult> {
  const provider = config.provider || 'mock';

  switch (provider) {
    case 'openai':
      return embedOpenAI(text);
    case 'minimax':
      return embedMinimax(text);
    default:
      return mockEmbed(text);
  }
}

/**
 * Mock 嵌入（测试用）
 */
function mockEmbed(text: string): EmbedResult {
  const dim = 1536;
  const embedding = Array.from({ length: dim }, (_, i) => {
    return Math.sin(i * 0.1 + text.length) * 0.1;
  });
  return { embedding, model: 'mock-embedding', tokens: Math.ceil(text.length / 4) };
}

/**
 * OpenAI 嵌入
 */
async function embedOpenAI(text: string): Promise<EmbedResult> {
  const apiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('No OpenAI API key, falling back to mock embedding');
    return mockEmbed(text);
  }

  const model = config.openaiModel || 'text-embedding-3-small';
  const endpoint = config.openaiEndpoint || 'https://api.openai.com/v1/embeddings';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text.slice(0, 8000),
    }),
  });

  if (!res.ok) {
    console.error('OpenAI Embed error:', await res.text());
    return mockEmbed(text);
  }

  const data = await res.json() as { data: Array<{ embedding: number[] }>; model: string; usage?: { total_tokens: number } };
  if (!data.data || data.data.length === 0) {
    return mockEmbed(text);
  }

  return {
    embedding: data.data[0]?.embedding ?? [],
    model: data.model,
    tokens: data.usage?.total_tokens || Math.ceil(text.length / 4),
  };
}

/**
 * MiniMax 嵌入
 */
async function embedMinimax(text: string): Promise<EmbedResult> {
  const apiKey = config.minimaxApiKey || process.env.MINIMAX_API_KEY;
  if (!apiKey) return { embedding: null, model: '', tokens: 0 };

  const model = config.minimaxModel || 'embo-01';
  const endpoint = config.minimaxEndpoint || 'https://api.minimaxi.com/v1/embeddings';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      texts: [text.slice(0, 8000)],
      type: 'db',
    }),
  });

  if (!res.ok) {
    console.error('MiniMax Embed error:', await res.text());
    return mockEmbed(text);
  }

  const data = await res.json() as { vectors: number[][] };
  if (!data.vectors || data.vectors.length === 0) {
    return mockEmbed(text);
  }

  return {
    embedding: data.vectors[0],
    model,
    tokens: Math.ceil(text.length / 4),
  };
}
