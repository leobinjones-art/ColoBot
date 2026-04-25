/**
 * LLM Provider 导出
 */

export { OpenAIProvider, type OpenAIConfig } from './openai.js';
export { AnthropicProvider, type AnthropicConfig } from './anthropic.js';

import type { LLMProvider } from '../runtime/types.js';
import { OpenAIProvider, type OpenAIConfig } from './openai.js';
import { AnthropicProvider, type AnthropicConfig } from './anthropic.js';

export type ProviderConfig = OpenAIConfig | AnthropicConfig;

/**
 * 创建 LLM Provider
 */
export function createLLMProvider(
  provider: 'openai' | 'anthropic',
  config: ProviderConfig
): LLMProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(config as OpenAIConfig);
    case 'anthropic':
      return new AnthropicProvider(config as AnthropicConfig);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
