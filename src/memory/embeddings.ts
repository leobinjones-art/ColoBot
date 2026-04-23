/**
 * 向量嵌入 - 使用 OpenAI / MiniMax Embeddings
 */

import { getMockLLM, getOpenAIApiKey, getMinimaxApiKey, getLlmProvider } from '../services/settings-cache.js';

export interface EmbedResult {
  embedding: number[] | null;
  model: string;
}

export async function embed(text: string): Promise<EmbedResult> {
  // Mock mode for local testing (no real API key needed)
  if (getMockLLM()) {
    return mockEmbed(text);
  }

  // 根据 LLM provider 选择 embedding provider
  const llmProvider = getLlmProvider();
  switch (llmProvider) {
    case 'minimax':
      return embedMinimax(text);
    case 'openai':
    case 'anthropic':
    default:
      return embedOpenAI(text);
  }
}

function mockEmbed(_text: string): EmbedResult {
  // Return a deterministic fake 1536-dim vector (OpenAI ada compatible)
  const dim = 1536;
  const embedding = Array.from({ length: dim }, (_, i) => {
    return Math.sin(i * 0.1 + _text.length) * 0.1;
  });
  return { embedding, model: 'mock-embedding' };
}

async function embedOpenAI(text: string): Promise<EmbedResult> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    // Fallback to mock embedding if no API key
    console.log('No OpenAI API key, falling back to mock embedding');
    return mockEmbed(text);
  }

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
    }),
  });

  if (!res.ok) {
    console.error('OpenAI Embed error:', await res.text());
    return mockEmbed(text);
  }

  const data = await res.json() as { data: Array<{ embedding: number[] }>; model: string };
  if (!data.data || data.data.length === 0) {
    return mockEmbed(text);
  }
  return { embedding: data.data[0]?.embedding ?? null, model: data.model };
}

async function embedMinimax(text: string): Promise<EmbedResult> {
  const apiKey = getMinimaxApiKey();
  if (!apiKey) return { embedding: null, model: '' };

  const res = await fetch('https://api.minimaxi.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'embo-01',
      texts: [text.slice(0, 8000)],
      type: 'db',
    }),
  });

  if (!res.ok) {
    console.error('MiniMax Embed error:', await res.text());
    // Fallback to mock embedding
    console.log('Falling back to mock embedding');
    return mockEmbed(text);
  }

  const data = await res.json() as { vectors: number[][]; base_resp?: { status_code: number } };
  if (!data.vectors || data.vectors.length === 0) {
    // 静默 fallback，避免日志刷屏
    return mockEmbed(text);
  }
  return { embedding: data.vectors[0], model: 'embo-01' };
}
