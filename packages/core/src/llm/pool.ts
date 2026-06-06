import type { LLMConfig } from './index.js'
import type { LLMMessage } from '@colomind/types'
import type { ProviderType } from '../config/llm-settings.js'
import { chatWithConfig } from './index.js'

export interface ProviderInstance {
  id: string
  provider: ProviderType
  apiKey: string
  endpoint: string
  model: string
  maxTokens?: number
  temperature?: number
  tags?: string[]
}

export class LLMPool {
  private providers = new Map<string, ProviderInstance>()
  private defaultId = 'default'

  register(instance: ProviderInstance): void {
    this.providers.set(instance.id, instance)
  }

  unregister(id: string): boolean {
    if (id === this.defaultId && this.providers.size > 1) {
      throw new Error(`Cannot unregister default provider "${id}"`)
    }
    const deleted = this.providers.delete(id)
    if (deleted && id === this.defaultId) {
      const first = this.providers.keys().next().value
      if (first) this.defaultId = first
    }
    return deleted
  }

  get(id?: string): ProviderInstance | undefined {
    return this.providers.get(id || this.defaultId)
  }

  getByTag(tag: string): ProviderInstance | undefined {
    for (const p of this.providers.values()) {
      if (p.tags?.includes(tag)) return p
    }
    return undefined
  }

  list(): ProviderInstance[] {
    return [...this.providers.values()]
  }

  setDefault(id: string): void {
    if (!this.providers.has(id)) throw new Error(`Provider "${id}" not registered`)
    this.defaultId = id
  }

  getDefault(): ProviderInstance | undefined {
    return this.providers.get(this.defaultId)
  }

  getDefaultId(): string {
    return this.defaultId
  }

  toConfig(id?: string): LLMConfig | undefined {
    const instance = this.get(id)
    if (!instance) return undefined
    return {
      provider: instance.provider,
      apiKey: instance.apiKey,
      endpoint: instance.endpoint,
      model: instance.model,
      maxTokens: instance.maxTokens,
      temperature: instance.temperature,
    }
  }

  async chat(messages: LLMMessage[], options?: { providerId?: string; maxTokens?: number; temperature?: number }): Promise<string> {
    const config = this.toConfig(options?.providerId)
    if (!config) throw new Error(`No LLM provider available (requested: ${options?.providerId || this.defaultId})`)

    const merged: LLMConfig = {
      ...config,
      maxTokens: options?.maxTokens ?? config.maxTokens ?? 4096,
      temperature: options?.temperature ?? config.temperature ?? 0.7,
    }

    const response = await chatWithConfig(messages, merged, {
      maxTokens: merged.maxTokens,
      temperature: merged.temperature,
    })

    return typeof response.content === 'string' ? response.content : ''
  }
}

export const llmPool = new LLMPool()