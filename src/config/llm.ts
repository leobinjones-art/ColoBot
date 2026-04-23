/**
 * LLM 模型配置
 * 支持环境变量覆盖默认值
 */

export interface ModelConfig {
  /** 默认模型名称 */
  defaultModel: string;
  /** API 端点 */
  apiEndpoint: string;
  /** Embedding 模型名称（可选） */
  embeddingModel?: string;
  /** Embedding API 端点（可选） */
  embeddingEndpoint?: string;
}

export interface LLMConfig {
  openai: ModelConfig;
  anthropic: ModelConfig;
  minimax: ModelConfig;
}

/**
 * 默认模型配置
 * 可通过环境变量覆盖：
 * - OPENAI_DEFAULT_MODEL
 * - ANTHROPIC_DEFAULT_MODEL
 * - MINIMAX_DEFAULT_MODEL
 */
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  openai: {
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o',
    apiEndpoint: process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    embeddingEndpoint: process.env.OPENAI_EMBEDDING_ENDPOINT || 'https://api.openai.com/v1/embeddings',
  },
  anthropic: {
    defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-20250514',
    apiEndpoint: process.env.ANTHROPIC_API_ENDPOINT || 'https://api.anthropic.com/v1/messages',
  },
  minimax: {
    defaultModel: process.env.MINIMAX_DEFAULT_MODEL || 'MiniMax-M2.7-highspeed',
    apiEndpoint: process.env.MINIMAX_API_ENDPOINT || 'https://api.minimaxi.com/anthropic/v1/messages',
    embeddingModel: process.env.MINIMAX_EMBEDDING_MODEL || 'embo-01',
    embeddingEndpoint: process.env.MINIMAX_EMBEDDING_ENDPOINT || 'https://api.minimaxi.com/v1/embeddings',
  },
};

/**
 * 获取指定 provider 的默认模型
 */
export function getDefaultModel(provider: 'openai' | 'anthropic' | 'minimax'): string {
  return DEFAULT_LLM_CONFIG[provider].defaultModel;
}

/**
 * 获取指定 provider 的 API 端点
 */
export function getApiEndpoint(provider: 'openai' | 'anthropic' | 'minimax'): string {
  return DEFAULT_LLM_CONFIG[provider].apiEndpoint;
}

/**
 * 获取 embedding 配置
 */
export function getEmbeddingConfig(provider: 'openai' | 'minimax'): { model: string; endpoint: string } | null {
  const config = DEFAULT_LLM_CONFIG[provider];
  if (!config.embeddingModel || !config.embeddingEndpoint) {
    return null;
  }
  return { model: config.embeddingModel, endpoint: config.embeddingEndpoint };
}
