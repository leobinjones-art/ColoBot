/**
 * LLMProvider 适配器
 *
 * 将 LLMConfig + chatWithConfig 包装成 @colomind/types 的 LLMProvider 接口
 * 用于需要 LLMProvider 类型参数的组件（如 Sentinel InferenceAgent）
 *
 * Note: chatStream() currently yields the full response in one chunk.
 * True streaming support will be added when chatStreamWithConfig is implemented in core.
 */

import type {
  LLMProvider,
  LLMMessage,
  LLMOptions,
  LLMResponse,
  LLMStreamChunk,
} from '@colomind/types'
import type { LLMConfig } from './index.js'
import { chatWithConfig } from './index.js'

export class LLMPoolProvider implements LLMProvider {
  name: string
  private config: LLMConfig

  constructor(name: string, config: LLMConfig) {
    this.name = name
    this.config = config
  }

  updateConfig(config: LLMConfig): void {
    this.config = config
  }

  getConfig(): LLMConfig {
    return this.config
  }

  async chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const response = await chatWithConfig(messages, this.config, {
      model: options?.model,
      maxTokens: options?.maxTokens ?? options?.max_tokens,
      temperature: options?.temperature,
    })
    return {
      content: response.content,
      toolCalls: response.toolCalls?.map(tc => ({
        ...tc,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
      })),
    }
  }

  async *chatStream(messages: LLMMessage[], options?: LLMOptions): AsyncIterable<LLMStreamChunk> {
    // Non-streaming fallback — yields full response then done
    // TODO: use chatStreamWithConfig once implemented in core
    const response = await this.chat(messages, options)
    if (typeof response.content === 'string') {
      yield { type: 'text', content: response.content }
    }
    yield { type: 'done' }
  }
}
