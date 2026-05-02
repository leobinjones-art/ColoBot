/**
 * 统一聊天 Composable
 */
import { ref, computed } from 'vue'
import { useMarkdownRenderer } from '../useMarkdownRenderer'
import type { Message, StreamPhase, QueuedMessage } from '@/types'

export interface UseChatOptions {
  baseUrl: string
  agentId: string | number
  conversationId?: string
}

export interface UseChatReturn {
  messages: import('vue').Ref<Message[]>
  isGenerating: import('vue').ComputedRef<boolean>
  streamPhase: import('vue').Ref<StreamPhase>
  queuedMessage: import('vue').Ref<QueuedMessage | null>
  sendMessage: (content: string) => Promise<void>
  stopGeneration: () => void
  clearMessages: () => void
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { baseUrl, agentId, conversationId } = options

  const messages = ref<Message[]>([])
  const streamPhase = ref<StreamPhase>('idle')
  const queuedMessage = ref<QueuedMessage | null>(null)

  const isGenerating = computed(() => streamPhase.value !== 'idle' && streamPhase.value !== 'completed')

  const { renderMarkdown } = useMarkdownRenderer()

  let currentController: AbortController | null = null

  async function sendMessage(content: string) {
    if (!content.trim()) return

    // 添加用户消息
    const userMsg: Message = {
      id: Date.now().toString(),
      conversationId: conversationId || '',
      role: 'user',
      content,
      contentParts: [{ type: 'text', text: content }],
    }
    messages.value.push(userMsg)

    // 添加助手消息占位
    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      conversationId: conversationId || '',
      role: 'assistant',
      content: '',
      contentParts: [],
      status: 'generating',
    }
    messages.value.push(assistantMsg)

    streamPhase.value = 'thinking'

    currentController = new AbortController()

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${baseUrl}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          agentId,
          conversationId,
          message: content,
        }),
        signal: currentController.signal,
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              handleEvent(data, assistantMsg)
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      assistantMsg.status = 'completed'
      streamPhase.value = 'completed'
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        assistantMsg.status = 'failed'
        streamPhase.value = 'failed'
      }
    } finally {
      currentController = null
    }
  }

  function handleEvent(data: any, assistantMsg: Message) {
    switch (data.type) {
      case 'content_delta':
        assistantMsg.content += data.content
        streamPhase.value = 'streaming'
        break
      case 'thinking_delta':
        streamPhase.value = 'thinking'
        break
      case 'phase':
        streamPhase.value = data.phase
        break
      case 'tool_call_started':
        streamPhase.value = 'executing_tool'
        break
      case 'done':
        assistantMsg.status = 'completed'
        streamPhase.value = 'completed'
        break
      case 'error':
        assistantMsg.status = 'failed'
        streamPhase.value = 'failed'
        break
    }
  }

  function stopGeneration() {
    currentController?.abort()
    streamPhase.value = 'idle'
  }

  function clearMessages() {
    messages.value = []
  }

  return {
    messages,
    isGenerating,
    streamPhase,
    queuedMessage,
    sendMessage,
    stopGeneration,
    clearMessages,
  }
}