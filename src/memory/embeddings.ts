/**
 * 向量嵌入 - 使用 OpenAI / MiniMax Embeddings
 */

let embeddingProvider: 'openai' | 'minimax' = 'openai';

export function setEmbedProvider(provider: 'openai' | 'minimax'): void {
  embeddingProvider = provider;
}

export interface EmbedResult {
  embedding: number[] | null;
  model: string;
}

export async function embed(text: string): Promise<EmbedResult> {
  // Mock mode for local testing (no real API key needed)
  if (process.env.MOCK_LLM === 'true') {
    return mockEmbed(text);
  }

  switch (embeddingProvider) {
    case 'openai':
      return embedOpenAI(text);
    case 'minimax':
      return embedMinimax(text);
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { embedding: null, model: '' };

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
    return { embedding: null, model: '' };
  }

  const data = await res.json() as { data: Array<{ embedding: number[] }>; model: string };
  return { embedding: data.data[0]?.embedding ?? null, model: data.model };
}

async function embedMinimax(text: string): Promise<EmbedResult> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return { embedding: null, model: '' };

  const res = await fetch('https://api.minimax.chat/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'embo-01',
      input: text.slice(0, 8000),
    }),
  });

  if (!res.ok) {
    console.error('MiniMax Embed error:', await res.text());
    return { embedding: null, model: '' };
  }

  const data = await res.json() as { data: Array<{ embedding: number[] }>; model: string };
  return { embedding: data.data[0]?.embedding ?? null, model: data.model };
}
