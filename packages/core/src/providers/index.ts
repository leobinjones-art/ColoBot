/**
 * LLM Provider 导出
 */

export { OpenAIProvider, type OpenAIConfig } from './openai.js';
export { AnthropicProvider, type AnthropicConfig } from './anthropic.js';
export { MiniMaxProvider, type MiniMaxConfig } from './minimax.js';
export { MockProvider, type MockConfig } from './mock.js';
export {
  chatWithFallback,
  chatStreamWithFallback,
  parseFallbackString,
  type FallbackEntry,
  type FallbackConfig,
} from './fallback.js';

import type { LLMProvider } from '../runtime/types.js';
import { OpenAIProvider, type OpenAIConfig } from './openai.js';
import { AnthropicProvider, type AnthropicConfig } from './anthropic.js';
import { MiniMaxProvider, type MiniMaxConfig } from './minimax.js';
import { MockProvider, type MockConfig } from './mock.js';

export type ProviderConfig = OpenAIConfig | AnthropicConfig | MiniMaxConfig | MockConfig;

/**
 * 创建 LLM Provider
 */
export function createLLMProvider(
  provider: 'openai' | 'anthropic' | 'minimax' | 'mock',
  config: ProviderConfig
): LLMProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(config as OpenAIConfig);
    case 'anthropic':
      return new AnthropicProvider(config as AnthropicConfig);
    case 'minimax':
      return new MiniMaxProvider(config as MiniMaxConfig);
    case 'mock':
      return new MockProvider(config as MockConfig);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
