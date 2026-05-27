/**
 * E2E 测试 - Assistant 包集成测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// ── Assistant 包测试 ──────────────────────────────────────────────

describe('E2E: @colomind/assistant', () => {
  describe('exports', () => {
    it('should export database functions', async () => {
      const assistant = await import('@colomind/assistant')

      expect(assistant.getDb).toBeDefined()
      expect(assistant.closeDb).toBeDefined()
      expect(assistant.generateId).toBeDefined()
    })

    it('should export todo functions', async () => {
      const assistant = await import('@colomind/assistant')

      expect(assistant.createTodo).toBeDefined()
      expect(assistant.getTodo).toBeDefined()
      expect(assistant.updateTodo).toBeDefined()
      expect(assistant.deleteTodo).toBeDefined()
      expect(assistant.listTodos).toBeDefined()
      expect(assistant.getTodayTodos).toBeDefined()
      expect(assistant.completeTodo).toBeDefined()
    })

    it('should export reminder functions', async () => {
      const assistant = await import('@colomind/assistant')

      expect(assistant.createReminder).toBeDefined()
      expect(assistant.getReminder).toBeDefined()
      expect(assistant.listReminders).toBeDefined()
      expect(assistant.completeReminder).toBeDefined()
      expect(assistant.cancelReminder).toBeDefined()
    })

    it('should export event functions', async () => {
      const assistant = await import('@colomind/assistant')

      expect(assistant.createEvent).toBeDefined()
      expect(assistant.getEvent).toBeDefined()
      expect(assistant.updateEvent).toBeDefined()
      expect(assistant.deleteEvent).toBeDefined()
      expect(assistant.getDayEvents).toBeDefined()
      expect(assistant.getWeekEvents).toBeDefined()
      expect(assistant.getMonthEvents).toBeDefined()
    })

    it('should export note functions', async () => {
      const assistant = await import('@colomind/assistant')

      expect(assistant.createNote).toBeDefined()
      expect(assistant.getNote).toBeDefined()
      expect(assistant.updateNote).toBeDefined()
      expect(assistant.deleteNote).toBeDefined()
      expect(assistant.listNotes).toBeDefined()
      expect(assistant.searchNotes).toBeDefined()
    })

    it('should export habit functions', async () => {
      const assistant = await import('@colomind/assistant')

      expect(assistant.createHabit).toBeDefined()
      expect(assistant.getHabit).toBeDefined()
      expect(assistant.listHabits).toBeDefined()
      expect(assistant.deleteHabit).toBeDefined()
      expect(assistant.checkHabit).toBeDefined()
      expect(assistant.getHabitLogs).toBeDefined()
      expect(assistant.getStreak).toBeDefined()
    })

    it('should export mood functions', async () => {
      const assistant = await import('@colomind/assistant')

      expect(assistant.logMood).toBeDefined()
      expect(assistant.getMoodEntries).toBeDefined()
      expect(assistant.getDayMood).toBeDefined()
      expect(assistant.getMoodStats).toBeDefined()
    })

    it('should export finance functions', async () => {
      const assistant = await import('@colomind/assistant')

      expect(assistant.logFinance).toBeDefined()
      expect(assistant.getFinanceEntries).toBeDefined()
      expect(assistant.getFinanceStats).toBeDefined()
      expect(assistant.getMonthlyStats).toBeDefined()
    })

    it('should export goal functions', async () => {
      const assistant = await import('@colomind/assistant')

      expect(assistant.createGoal).toBeDefined()
      expect(assistant.getGoal).toBeDefined()
      expect(assistant.listGoals).toBeDefined()
      expect(assistant.deleteGoal).toBeDefined()
      expect(assistant.updateGoalProgress).toBeDefined()
    })

    it('should export contact functions', async () => {
      const assistant = await import('@colomind/assistant')

      expect(assistant.createContact).toBeDefined()
      expect(assistant.getContact).toBeDefined()
      expect(assistant.updateContact).toBeDefined()
      expect(assistant.listContacts).toBeDefined()
      expect(assistant.searchContacts).toBeDefined()
      expect(assistant.deleteContact).toBeDefined()
    })

    it('should export intent functions', async () => {
      const assistant = await import('@colomind/assistant')

      expect(assistant.parseIntent).toBeDefined()
      expect(assistant.parseIntentWithLLM).toBeDefined()
    })

    it('should export profile functions', async () => {
      const assistant = await import('@colomind/assistant')

      expect(assistant.generateUserProfile).toBeDefined()
      expect(assistant.getUserContext).toBeDefined()
    })
  })

  describe('database', () => {
    it('should generate unique IDs', async () => {
      const { generateId } = await import('@colomind/assistant')

      const id1 = generateId()
      const id2 = generateId()

      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
    })
  })
})

// ── Charter 包测试 ──────────────────────────────────────────────

describe('E2E: @colomind/charter', () => {
  describe('exports', () => {
    it('should export charter types', async () => {
      const charter = await import('@colomind/charter')

      expect(charter).toBeDefined()
    })
  })
})

// ── Core Data API 测试 ──────────────────────────────────────────────

describe('E2E: Core Data API', () => {
  describe('data operations', () => {
    it('should export listTodos', async () => {
      const core = await import('@colomind/core')

      expect(core.listTodos).toBeDefined()
    })

    it('should export listReminders', async () => {
      const core = await import('@colomind/core')

      expect(core.listReminders).toBeDefined()
    })

    it('should export listNotes', async () => {
      const core = await import('@colomind/core')

      expect(core.listNotes).toBeDefined()
    })

    it('should export listHabits', async () => {
      const core = await import('@colomind/core')

      expect(core.listHabits).toBeDefined()
    })

    it('should export getMoodEntries', async () => {
      const core = await import('@colomind/core')

      expect(core.getMoodEntries).toBeDefined()
    })

    it('should export getFinanceEntries', async () => {
      const core = await import('@colomind/core')

      expect(core.getFinanceEntries).toBeDefined()
    })

    it('should export listGoals', async () => {
      const core = await import('@colomind/core')

      expect(core.listGoals).toBeDefined()
    })

    it('should export listContacts', async () => {
      const core = await import('@colomind/core')

      expect(core.listContacts).toBeDefined()
    })

    it('should export parseIntent', async () => {
      const core = await import('@colomind/core')

      expect(core.parseIntent).toBeDefined()
    })

    it('should export generateUserProfile', async () => {
      const core = await import('@colomind/core')

      expect(core.generateUserProfile).toBeDefined()
    })
  })

  describe('assistant integration', () => {
    it('should export loadUserContext', async () => {
      const core = await import('@colomind/core')

      expect(core.loadUserContext).toBeDefined()
    })

    it('should export buildMessagesWithContext', async () => {
      const core = await import('@colomind/core')

      expect(core.buildMessagesWithContext).toBeDefined()
    })

    it('should build messages with context', async () => {
      const { buildMessagesWithContext } = await import('@colomind/core')

      const history = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi' },
      ]

      const messages = buildMessagesWithContext(history, 'New message', 'User context')

      expect(messages).toHaveLength(4) // context + history + new message
      expect(messages[0].role).toBe('system')
      expect(messages[0].content).toBe('User context')
      expect(messages[messages.length - 1].role).toBe('user')
    })

    it('should build messages without context', async () => {
      const { buildMessagesWithContext } = await import('@colomind/core')

      const history = [
        { role: 'user' as const, content: 'Hello' },
      ]

      const messages = buildMessagesWithContext(history, 'New message')

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('user')
      expect(messages[1].role).toBe('user')
    })
  })
})

// ── TUI Markdown 测试 ──────────────────────────────────────────────

describe('E2E: TUI Markdown', () => {
  it('should export renderMarkdown', async () => {
    const tui = await import('@colomind/tui')

    expect(tui.renderMarkdown).toBeDefined()
  })

  it('should export printMarkdown', async () => {
    const tui = await import('@colomind/tui')

    expect(tui.printMarkdown).toBeDefined()
  })

  it('should render markdown text', async () => {
    const { renderMarkdown } = await import('@colomind/tui')

    const result = renderMarkdown('# Hello\n\nThis is **bold**')

    expect(result).toContain('Hello')
    expect(result).toContain('bold')
  })
})

// ── Health Check 测试 ──────────────────────────────────────────────

describe('E2E: Health Check', () => {
  it('should export health check functions', async () => {
    const core = await import('@colomind/core')

    expect(core.initHealthChecker).toBeDefined()
    expect(core.healthCheck).toBeDefined()
    expect(core.livenessCheck).toBeDefined()
    expect(core.readinessCheck).toBeDefined()
  })

  it('should perform health check', async () => {
    const { healthCheck } = await import('@colomind/core')

    const health = await healthCheck()

    expect(health).toBeDefined()
  })
})

// ── Error Handling 测试 ──────────────────────────────────────────────

describe('E2E: Error Handling', () => {
  it('should export error classes', async () => {
    const core = await import('@colomind/core')

    expect(core.AppError).toBeDefined()
    expect(core.UserError).toBeDefined()
    expect(core.AuthError).toBeDefined()
    expect(core.NotFoundError).toBeDefined()
    expect(core.RateLimitError).toBeDefined()
    expect(core.LLMError).toBeDefined()
    expect(core.DatabaseError).toBeDefined()
    expect(core.NetworkError).toBeDefined()
  })

  it('should create AppError', async () => {
    const { AppError } = await import('@colomind/core')

    const error = new AppError('Test error')

    expect(error.message).toBe('Test error')
  })

  it('should create UserError', async () => {
    const { UserError } = await import('@colomind/core')

    const error = new UserError('User error')

    expect(error.message).toBe('User error')
    expect(error instanceof Error).toBe(true)
  })

  it('should create NotFoundError', async () => {
    const { NotFoundError } = await import('@colomind/core')

    const error = new NotFoundError('Resource not found')

    expect(error.message).toContain('Resource not found')
  })
})

// ── Graceful Shutdown 测试 ──────────────────────────────────────────────

describe('E2E: Graceful Shutdown', () => {
  it('should export shutdown functions', async () => {
    const core = await import('@colomind/core')

    expect(core.GracefulShutdown).toBeDefined()
    expect(core.createGracefulShutdown).toBeDefined()
    expect(core.setupSimpleShutdown).toBeDefined()
  })

  it('should create GracefulShutdown instance', async () => {
    const { GracefulShutdown } = await import('@colomind/core')

    const shutdown = new GracefulShutdown()

    expect(shutdown).toBeDefined()
  })
})
