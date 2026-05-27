/**
 * LLM 相关类型
 */

// 内容块类型
export type TextContent = { type: 'text'; text: string }
export type ImageUrlContent = {
  type: 'image_url'
  image_url: { url: string; detail?: 'low' | 'high' | 'auto' }
}
export type AudioContent = { type: 'input_audio'; input_audio: { data: string; format: string } }
export type ContentBlock = TextContent | ImageUrlContent | AudioContent

// LLM 消息
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ContentBlock[]
  name?: string
  tool_call_id?: string
}

// LLM 选项
export interface LLMOptions {
  model?: string
  temperature?: number
  max_tokens?: number
  maxTokens?: number
  stream?: boolean
  tools?: ToolDefinition[]
}

// 工具定义
export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

// 模型配置
export interface ModelConfig {
  model: string
  endpoint: string
  max_tokens?: number
  temperature?: number
}

// LLM 配置
export interface LLMConfig {
  openai: ModelConfig
  anthropic: ModelConfig
  embedding: {
    openai: ModelConfig
  }
}

// LLM Provider 接口
export interface LLMProvider {
  name: string
  chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>
  chatStream(messages: LLMMessage[], options?: LLMOptions): AsyncIterable<LLMStreamChunk>
}

export interface LLMResponse {
  content: string | ContentBlock[]
  toolCalls?: ToolCall[]
  usage?: { inputTokens: number; outputTokens: number }
}

export interface LLMStreamChunk {
  type: 'text' | 'tool_call' | 'done'
  content?: string
  toolCall?: ToolCall
}

// 工具调用
export interface ToolCall {
  name: string
  args: Record<string, unknown>
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}
