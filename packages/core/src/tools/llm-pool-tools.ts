import { llmPool, type ProviderInstance } from '../llm/pool.js'
import { toolRegistry } from './registry.js'

async function registerProviderTool(args: Record<string, unknown>): Promise<string> {
  const { id, provider, apiKey, endpoint, model, maxTokens, temperature, tags } = args as {
    id: string
    provider: string
    apiKey: string
    endpoint: string
    model: string
    maxTokens?: number
    temperature?: number
    tags?: string[]
  }

  if (!id || !provider || !apiKey || !endpoint || !model) {
    throw new Error('Missing required fields: id, provider, apiKey, endpoint, model')
  }
  if (provider !== 'openai' && provider !== 'anthropic') {
    throw new Error('Provider must be "openai" or "anthropic"')
  }

  const instance: ProviderInstance = {
    id,
    provider: provider as 'openai' | 'anthropic',
    apiKey,
    endpoint,
    model,
    maxTokens,
    temperature,
    tags,
  }

  llmPool.register(instance)
  return JSON.stringify({ ok: true, id, provider, model })
}

async function listProvidersTool(): Promise<string> {
  const providers = llmPool.list()
  const defaultId = llmPool.getDefaultId()
  return JSON.stringify(
    providers.map((p) => ({
      ...p,
      apiKey: `${p.apiKey.slice(0, 8)}...`,
      isDefault: p.id === defaultId,
    })),
    null,
    2,
  )
}

async function setDefaultProviderTool(args: Record<string, unknown>): Promise<string> {
  const { id } = args as { id: string }
  if (!id) throw new Error('Missing required field: id')
  llmPool.setDefault(id)
  return JSON.stringify({ ok: true, defaultProvider: id })
}

export function registerLLMPoolTools(): void {
  toolRegistry.register({
    name: 'register_provider',
    description: 'Register a new LLM provider into the pool (e.g. a faster/cheaper model for specific tasks)',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique provider ID (e.g. "fast", "cheap", "summarizer")' },
        provider: { type: 'string', description: 'Provider type: "openai" or "anthropic"' },
        apiKey: { type: 'string', description: 'API key for the provider' },
        endpoint: { type: 'string', description: 'API endpoint URL' },
        model: { type: 'string', description: 'Model ID (e.g. "claude-haiku-4-5-20251001", "gpt-4o-mini")' },
        maxTokens: { type: 'number', description: 'Max tokens for responses' },
        temperature: { type: 'number', description: 'Temperature (0-1)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for selection (e.g. ["fast", "cheap"])' },
      },
      required: ['id', 'provider', 'apiKey', 'endpoint', 'model'],
    },
    execute: registerProviderTool,
  })

  toolRegistry.register({
    name: 'list_providers',
    description: 'List all registered LLM providers in the pool',
    parameters: { type: 'object', properties: {} },
    execute: listProvidersTool,
  })

  toolRegistry.register({
    name: 'set_default_provider',
    description: 'Switch the default LLM provider used for conversations',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Provider ID to set as default' },
      },
      required: ['id'],
    },
    execute: setDefaultProviderTool,
  })
}
