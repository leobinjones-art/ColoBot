/**
 * Data Operations - Unified API for data operations
 *
 * Internally calls @colomind/assistant if available
 * Provides a clean API for external callers (like frontend server)
 */

// Lazy load Assistant
let _assistant: any = null
async function getAssistant() {
  if (_assistant === null) {
    try {
      _assistant = await import('@colomind/assistant')
    } catch {
      _assistant = undefined
    }
  }
  return _assistant
}

// ─────────────────────────────────────────────────────────────
// Todo
// ─────────────────────────────────────────────────────────────

export async function listTodos(userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.listTodos(userId)
}

export async function getTodayTodos(userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.getTodayTodos(userId)
}

export async function createTodo(input: any, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.createTodo(input)
}

export async function updateTodo(id: string, input: any, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.updateTodo(id, userId, input)
}

export async function deleteTodo(id: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.deleteTodo(id, userId)
}

export async function completeTodo(id: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.completeTodo(id, userId)
}

// ─────────────────────────────────────────────────────────────
// Reminder
// ─────────────────────────────────────────────────────────────

export async function listReminders(userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.listReminders(userId)
}

export async function createReminder(input: any, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.createReminder(input)
}

export async function deleteReminder(id: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.deleteReminder(id, userId)
}

export async function completeReminder(id: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.completeReminder(id, userId)
}

// ─────────────────────────────────────────────────────────────
// Event
// ─────────────────────────────────────────────────────────────

export async function getDayEvents(date: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.getDayEvents(date, userId)
}

export async function getWeekEvents(userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.getWeekEvents(userId)
}

export async function getMonthEvents(start: string | undefined, end: string | undefined, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.getMonthEvents(userId, start, end)
}

export async function createEvent(input: any, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.createEvent(input)
}

export async function updateEvent(id: string, input: any, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.updateEvent(id, userId, input)
}

export async function deleteEvent(id: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.deleteEvent(id, userId)
}

// ─────────────────────────────────────────────────────────────
// Note
// ─────────────────────────────────────────────────────────────

export async function listNotes(userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.listNotes(userId)
}

export async function searchNotes(q: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.searchNotes(q, userId)
}

export async function createNote(input: any, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.createNote(input)
}

export async function updateNote(id: string, input: any, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.updateNote(id, userId, input)
}

export async function deleteNote(id: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.deleteNote(id, userId)
}

// ─────────────────────────────────────────────────────────────
// Habit
// ─────────────────────────────────────────────────────────────

export async function listHabits(userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.listHabits(userId)
}

export async function createHabit(input: any, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.createHabit(userId, input.name, input.frequency)
}

export async function deleteHabit(id: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.deleteHabit(id, userId)
}

export async function checkHabit(id: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.checkHabit(id, userId)
}

export async function getHabitLogs(id: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.getHabitLogs(id, userId)
}

// ─────────────────────────────────────────────────────────────
// Mood
// ─────────────────────────────────────────────────────────────

export async function getMoodEntries(userId: string, limit?: number) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.getMoodEntries(userId, limit)
}

export async function logMood(input: any, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.logMood(userId, input.mood, input.score, input.note)
}

export async function getMoodStats(userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return { average: 0, count: 0 }
  return assistant.getMoodStats(userId)
}

// ─────────────────────────────────────────────────────────────
// Finance
// ─────────────────────────────────────────────────────────────

export async function getFinanceEntries(userId: string, start?: string, end?: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.getFinanceEntries(userId, start, end)
}

export async function logFinance(input: any, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.logFinance(userId, input.type, input.amount, input.category, input.note)
}

export async function getFinanceStats(userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return { totalIncome: 0, totalExpense: 0 }
  return assistant.getFinanceStats(userId)
}

export async function getMonthlyStats(userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.getMonthlyStats(userId)
}

// ─────────────────────────────────────────────────────────────
// Goal
// ─────────────────────────────────────────────────────────────

export async function listGoals(userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.listGoals(userId)
}

export async function createGoal(input: any, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.createGoal(userId, input.title, input.description, input.targetDate)
}

export async function deleteGoal(id: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.deleteGoal(id, userId)
}

export async function updateGoalProgress(id: string, progress: number, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.updateGoalProgress(id, userId, progress)
}

// ─────────────────────────────────────────────────────────────
// Contact
// ─────────────────────────────────────────────────────────────

export async function listContacts(userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.listContacts(userId)
}

export async function searchContacts(q: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) return []
  return assistant.searchContacts(q, userId)
}

export async function createContact(input: any, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  const { name, ...options } = input
  return assistant.createContact(userId, name, options)
}

export async function updateContact(id: string, input: any, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.updateContact(id, userId, input)
}

export async function deleteContact(id: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.deleteContact(id, userId)
}

// ─────────────────────────────────────────────────────────────
// Intent
// ─────────────────────────────────────────────────────────────

export async function parseIntent(text: string, userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  return assistant.parseIntent(text, userId)
}

// ─────────────────────────────────────────────────────────────
// User Profile
// ─────────────────────────────────────────────────────────────

export async function generateUserProfile(userId: string) {
  const assistant = await getAssistant()
  if (!assistant) throw new Error('Assistant not available')
  const data = {
    moods: await assistant.getMoodEntries(userId),
    habits: await assistant.listHabits(userId),
    todos: await assistant.listTodos(userId),
    goals: await assistant.listGoals(userId),
    contacts: await assistant.listContacts(userId),
    finances: await assistant.getFinanceEntries(userId),
    healthEntries: await assistant.getHealthEntries(userId),
    notes: await assistant.listNotes(userId),
    events: await assistant.getMonthEvents(userId),
  }
  return assistant.generateUserProfile(userId, data)
}
