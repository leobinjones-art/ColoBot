/**
 * SSE 流处理 Composable
 */
import { ref } from 'vue'

export type SSEEventType =
  | 'content_delta'
  | 'thinking_delta'
  | 'message_complete'
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'phase'
  | 'heartbeat'
  | 'error'
  | 'done'

export interface SSEEvent {
  type: SSEEventType
  data: any
}

export interface UseStreamOptions {
  url: string
  headers?: Record<string, string>
  body?: any
}

export interface UseStreamReturn {
  isConnected: import('vue').Ref<boolean>
  error: import('vue').Ref<Error | null>
  connect: () => Promise<void>
  disconnect: () => void
  on: (event: SSEEventType, handler: (data: any) => void) => () => void
}

class SSEParser {
  private buffer = ''
  private readonly separator = '\n\n'

  parse(chunk: string): SSEEvent[] {
    this.buffer += chunk
    const events: SSEEvent[] = []
    const parts = this.buffer.split(this.separator)
    this.buffer = parts.pop() || ''

    for (const part of parts) {
      const lines = part.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            events.push({ type: data.type || 'content_delta', data })
          } catch {
            // ignore parse errors
          }
        }
      }
    }
    return events
  }
}

export function useStream(options: UseStreamOptions): UseStreamReturn {
  const { url, headers = {}, body } = options

  const isConnected = ref(false)
  const error = ref<Error | null>(null)

  let controller: AbortController | null = null
  const handlers = new Map<SSEEventType, Set<(data: any) => void>>()

  async function connect() {
    controller = new AbortController()
    isConnected.value = true
    error.value = null

    try {
      const token = localStorage.getItem('token')
      const requestHeaders: Record<string, string> = {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...headers,
      }
      if (token) requestHeaders.Authorization = `Bearer ${token}`

      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const parser = new SSEParser()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const events = parser.parse(chunk)

        for (const event of events) {
          const eventHandlers = handlers.get(event.type)
          if (eventHandlers) {
            for (const handler of eventHandlers) {
              handler(event.data)
            }
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        error.value = e
      }
    } finally {
      isConnected.value = false
    }
  }

  function disconnect() {
    controller?.abort()
    isConnected.value = false
  }

  function on(event: SSEEventType, handler: (data: any) => void): () => void {
    if (!handlers.has(event)) {
      handlers.set(event, new Set())
    }
    handlers.get(event)!.add(handler)
    return () => handlers.get(event)?.delete(handler)
  }

  return { isConnected, error, connect, disconnect, on }
}