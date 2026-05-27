/**
 * Assistant Integration - Optional user context loading
 *
 * Core can optionally load user context from @colomind/assistant
 * If assistant is not installed, this gracefully returns null
 */

import type { LLMMessage } from '@colomind/types'

/**
 * Simplified UserProfileInput for Core
 * Uses unknown[] to avoid hard dependency on @colomind/assistant types
 * Caller should pass data from Assistant's actual UserProfileInput
 */
export interface UserProfileInput {
  moods: unknown[]
  habits: unknown[]
  todos: unknown[]
  goals: unknown[]
  contacts: unknown[]
  finances: unknown[]
  healthEntries: unknown[]
  notes: unknown[]
  events: unknown[]
}

export interface UserProfile {
  userId: string
  aiContext: string
  [key: string]: unknown
}

/**
 * Try to load user context from Assistant package
 *
 * @param userId - User identifier
 * @param data - User data (passed from application layer)
 * @returns User context string or null if assistant not available
 */
export async function loadUserContext(
  userId: string,
  data: UserProfileInput
): Promise<string | null> {
  try {
    // @ts-expect-error — optional dependency, may not be installed at build time
    const assistant: any = await import('@colomind/assistant')

    if (assistant.getUserContext) {
      return await assistant.getUserContext(userId, data)
    }

    return null
  } catch {
    return null
  }
}

/**
 * Build messages with optional user context
 *
 * @param history - Conversation history
 * @param userMessage - Current user message
 * @param userContext - Optional user context from Assistant
 * @returns Complete message array for LLM
 */
export function buildMessagesWithContext(
  history: LLMMessage[],
  userMessage: string | LLMMessage['content'],
  userContext?: string | null
): LLMMessage[] {
  const messages: LLMMessage[] = [...history]

  // Inject user context as system message
  if (userContext) {
    messages.unshift({
      role: 'system',
      content: userContext,
    })
  }

  // Add user message
  messages.push({
    role: 'user',
    content: userMessage,
  })

  return messages
}