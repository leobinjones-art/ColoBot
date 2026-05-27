/**
 * @colomind/assistant 测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { OpenAIProvider } from '@colomind/core'
import {
  getDb,
  closeDb,
  generateId,
  createTodo,
  getTodo,
  updateTodo,
  deleteTodo,
  listTodos,
  completeTodo,
  createReminder,
  listReminders,
  parseTime,
  parseIntent,
  parseIntentWithLLM,
  setLLMChat,
  createNote,
  searchNotes,
  createHabit,
  checkHabit,
  isTodayChecked,
  logMood,
  getMoodEntries,
  logFinance,
  getFinanceEntries,
  createGoal,
  updateGoalProgress,
  getGoal,
  createContact,
  searchContacts,
  createProject,
  updateProject,
  getProject,
} from '../index.js'

const API_KEY = process.env.OPENAI_API_KEY
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

describe('@colomind/assistant', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  describe('Database', () => {
    it('should create in-memory database', async () => {
      const { getDb, closeDb } = await import('../db/schema.js')

      const testDb = getDb({ inMemory: true })
      expect(testDb).toBeDefined()

      closeDb()
    })

    it('should generate unique IDs', async () => {
      const { generateId } = await import('../db/schema.js')

      const id1 = generateId()
      const id2 = generateId()

      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
    })
  })

  describe('Todo Module', () => {
    beforeEach(() => {
      // Create todos table
      db.exec(`
        CREATE TABLE IF NOT EXISTS assistant_todos (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          priority TEXT DEFAULT 'medium',
          status TEXT DEFAULT 'pending',
          due_date TEXT,
          tags TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          completed_at TEXT
        )
      `)
    })

    it('should create a todo', async () => {
      const { createTodo } = await import('../task/todo.js')

      const todo = createTodo(
        {
          userId: 'user-1',
          title: 'Test Todo',
          description: 'Test description',
          priority: 'high',
        },
        db,
      )

      expect(todo).toBeDefined()
      expect(todo.title).toBe('Test Todo')
      expect(todo.priority).toBe('high')
      expect(todo.status).toBe('pending')
    })

    it('should get a todo', async () => {
      const { createTodo, getTodo } = await import('../task/todo.js')

      const created = createTodo({ userId: 'user-1', title: 'Test' }, db)
      const todo = getTodo(created.id, 'user-1', db)

      expect(todo).toBeDefined()
      expect(todo?.title).toBe('Test')
    })

    it('should update a todo', async () => {
      const { createTodo, updateTodo } = await import('../task/todo.js')

      const created = createTodo({ userId: 'user-1', title: 'Test' }, db)
      const updated = updateTodo(created.id, 'user-1', { title: 'Updated' }, db)

      expect(updated?.title).toBe('Updated')
    })

    it('should complete a todo', async () => {
      const { createTodo, completeTodo } = await import('../task/todo.js')

      const created = createTodo({ userId: 'user-1', title: 'Test' }, db)
      const completed = completeTodo(created.id, 'user-1', db)

      expect(completed?.status).toBe('done')
      expect(completed?.completedAt).toBeDefined()
    })

    it('should delete a todo', async () => {
      const { createTodo, deleteTodo, getTodo } = await import('../task/todo.js')

      const created = createTodo({ userId: 'user-1', title: 'Test' }, db)
      const deleted = deleteTodo(created.id, 'user-1', db)

      expect(deleted).toBe(true)

      const todo = getTodo(created.id, 'user-1', db)
      expect(todo).toBeNull()
    })

    it('should list todos', async () => {
      const { createTodo, listTodos } = await import('../task/todo.js')

      createTodo({ userId: 'user-1', title: 'Todo 1' }, db)
      createTodo({ userId: 'user-1', title: 'Todo 2' }, db)

      const todos = listTodos('user-1', undefined, db)
      expect(todos).toHaveLength(2)
    })

    it('should filter todos by status', async () => {
      const { createTodo, listTodos, completeTodo } = await import('../task/todo.js')

      const t1 = createTodo({ userId: 'user-1', title: 'Todo 1' }, db)
      createTodo({ userId: 'user-1', title: 'Todo 2' }, db)
      completeTodo(t1.id, 'user-1', db)

      const pending = listTodos('user-1', { status: 'pending' }, db)
      expect(pending).toHaveLength(1)
    })
  })

  describe('Time Parser', () => {
    it('should parse relative time', async () => {
      const { parseTime } = await import('../task/time-parser.js')

      const result = parseTime('明天下午3点')
      expect(result).toBeDefined()
    })

    it('should parse absolute time', async () => {
      const { parseTime } = await import('../task/time-parser.js')

      const result = parseTime('2024-12-25 10:00')
      expect(result).toBeDefined()
    })

    it('should return null for invalid time', async () => {
      const { parseTime } = await import('../task/time-parser.js')

      const result = parseTime('invalid time')
      expect(result).toBeNull()
    })
  })

  describe('Reminder Module', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS assistant_reminders (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          remind_at TEXT NOT NULL,
          repeat TEXT DEFAULT 'none',
          status TEXT DEFAULT 'pending',
          created_at TEXT DEFAULT (datetime('now'))
        )
      `)
    })

    it('should create a reminder', async () => {
      const { createReminder } = await import('../task/reminder.js')

      const reminder = createReminder(
        {
          userId: 'user-1',
          title: 'Test Reminder',
          remindAt: new Date(Date.now() + 3600000).toISOString(),
        },
        db,
      )

      expect(reminder).toBeDefined()
      expect(reminder.title).toBe('Test Reminder')
      expect(reminder.status).toBe('pending')
    })

    it('should list reminders', async () => {
      const { createReminder, listReminders } = await import('../task/reminder.js')

      createReminder(
        {
          userId: 'user-1',
          title: 'Reminder 1',
          remindAt: new Date().toISOString(),
        },
        db,
      )

      const reminders = listReminders('user-1', undefined, db)
      expect(reminders).toHaveLength(1)
    })
  })

  describe('Note Module', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS assistant_notes (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          tags TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `)
    })

    it('should create a note', async () => {
      const { createNote } = await import('../knowledge/notes.js')

      const note = createNote(
        {
          userId: 'user-1',
          title: 'Test Note',
          content: 'Note content',
          tags: ['test', 'example'],
        },
        db,
      )

      expect(note).toBeDefined()
      expect(note.title).toBe('Test Note')
      expect(note.tags).toContain('test')
    })

    it('should search notes', async () => {
      const { createNote, searchNotes } = await import('../knowledge/notes.js')

      createNote({ userId: 'user-1', title: 'JavaScript Tips', content: 'Use const' }, db)
      createNote({ userId: 'user-1', title: 'Python Guide', content: 'Use type hints' }, db)

      const results = searchNotes('user-1', 'JavaScript', db)
      expect(results).toHaveLength(1)
      expect(results[0]?.title).toBe('JavaScript Tips')
    })
  })

  describe('Habit Module', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS assistant_habits (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          frequency TEXT DEFAULT 'daily',
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS assistant_habit_logs (
          id TEXT PRIMARY KEY,
          habit_id TEXT NOT NULL,
          logged_at TEXT DEFAULT (datetime('now')),
          note TEXT
        )
      `)
    })

    it('should create a habit', async () => {
      const { createHabit } = await import('../life/habit.js')

      const habit = createHabit('user-1', 'Exercise', 'daily', db)

      expect(habit).toBeDefined()
      expect(habit.name).toBe('Exercise')
    })

    it('should check habit', async () => {
      const { createHabit, checkHabit, isTodayChecked } = await import('../life/habit.js')

      const habit = createHabit('user-1', 'Exercise', 'daily', db)
      checkHabit(habit.id, undefined, db)

      const checked = isTodayChecked(habit.id, db)
      expect(checked).toBe(true)
    })
  })

  describe('Mood Module', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS assistant_moods (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          mood TEXT NOT NULL,
          score INTEGER,
          note TEXT,
          logged_at TEXT DEFAULT (datetime('now'))
        )
      `)
    })

    it('should log mood', async () => {
      const { logMood, getMoodEntries } = await import('../life/mood.js')

      const entry = logMood('user-1', 'happy', 8, undefined, db)

      expect(entry).toBeDefined()
      expect(entry.mood).toBe('happy')
      expect(entry.score).toBe(8)

      const entries = getMoodEntries('user-1', 30, db)
      expect(entries).toHaveLength(1)
    })
  })

  describe('Finance Module', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS assistant_finances (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          category TEXT,
          note TEXT,
          logged_at TEXT DEFAULT (datetime('now'))
        )
      `)
    })

    it('should log expense', async () => {
      const { logFinance, getFinanceEntries } = await import('../life/finance.js')

      const entry = logFinance('user-1', 'expense', 100, 'food', undefined, db)

      expect(entry).toBeDefined()
      expect(entry.type).toBe('expense')
      expect(entry.amount).toBe(100)

      const entries = getFinanceEntries('user-1', undefined, 30, db)
      expect(entries).toHaveLength(1)
    })
  })

  describe('Goal Module', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS assistant_goals (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          target_date TEXT,
          progress REAL DEFAULT 0,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT (datetime('now'))
        )
      `)
    })

    it('should create a goal', async () => {
      const { createGoal } = await import('../growth/goal.js')

      const goal = createGoal('user-1', 'Learn TypeScript', undefined, '2024-12-31', db)

      expect(goal).toBeDefined()
      expect(goal.title).toBe('Learn TypeScript')
      expect(goal.status).toBe('active')
    })

    it('should update goal progress', async () => {
      const { createGoal, updateGoalProgress, getGoal } = await import('../growth/goal.js')

      const created = createGoal('user-1', 'Test Goal', undefined, undefined, db)
      updateGoalProgress(created.id, 'user-1', 50, db)

      const goal = getGoal(created.id, 'user-1', db)
      expect(goal?.progress).toBe(50)
    })
  })

  describe('Contact Module', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS assistant_contacts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          organization TEXT,
          role TEXT,
          email TEXT,
          phone TEXT,
          tags TEXT,
          last_contact TEXT,
          note TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `)
    })

    it('should create a contact', async () => {
      const { createContact } = await import('../social/contact.js')

      const contact = createContact('user-1', 'John Doe', { email: 'john@example.com' }, db)

      expect(contact).toBeDefined()
      expect(contact.name).toBe('John Doe')
      expect(contact.email).toBe('john@example.com')
    })

    it('should search contacts', async () => {
      const { createContact, searchContacts } = await import('../social/contact.js')

      createContact('user-1', 'Alice', { email: 'alice@test.com' }, db)
      createContact('user-1', 'Bob', { email: 'bob@example.com' }, db)

      const results = searchContacts('user-1', 'alice', db)
      expect(results).toHaveLength(1)
      expect(results[0]?.name).toBe('Alice')
    })
  })

  describe('Project Module', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS assistant_projects (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'active',
          progress REAL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `)
    })

    it('should create a project', async () => {
      const { createProject } = await import('../project/project.js')

      const project = createProject('user-1', 'Website Redesign', undefined, db)

      expect(project).toBeDefined()
      expect(project.name).toBe('Website Redesign')
      expect(project.status).toBe('active')
    })

    it('should update project', async () => {
      const { createProject, updateProject, getProject } = await import('../project/project.js')

      const created = createProject('user-1', 'Test Project', undefined, db)
      updateProject(created.id, 'user-1', { progress: 75 }, db)

      const project = getProject(created.id, 'user-1', db)
      expect(project?.progress).toBe(75)
    })
  })

  describe('Intent Parser', () => {
    it('should parse reminder intent', async () => {
      const { parseIntent } = await import('../intent/parser.js')

      const intent = parseIntent('提醒我明天下午3点开会')
      expect(intent).toBeDefined()
      expect(intent?.type).toBe('reminder.add')
    })

    it('should parse todo intent', async () => {
      const { parseIntent } = await import('../intent/parser.js')

      const intent = parseIntent('记得买牛奶')
      expect(intent).toBeDefined()
      expect(intent?.type).toBe('todo.add')
    })

    it('should parse schedule list intent', async () => {
      const { parseIntent } = await import('../intent/parser.js')

      const intent = parseIntent('今天有什么日程')
      expect(intent).toBeDefined()
      expect(intent?.type).toBe('schedule.list')
    })

    it('should parse todo list intent', async () => {
      const { parseIntent } = await import('../intent/parser.js')

      const intent = parseIntent('列出我的待办')
      expect(intent).toBeDefined()
      expect(intent?.type).toBe('todo.list')
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // 使用真实 LLM 的意图识别测试
  // ═══════════════════════════════════════════════════════════════

  describe('Intent Parser（真实 LLM）', () => {
    it('应该通过 LLM 识别模糊意图', async () => {
      if (!API_KEY) return

      const provider = new OpenAIProvider({
        apiKey: API_KEY,
        baseUrl: BASE_URL,
        model: 'gpt-4o-mini',
      })

      // 注入真实 LLM 到意图解析器
      setLLMChat(async (messages, options) => {
        const response = await provider.chat(messages, options)
        const content = typeof response.content === 'string' ? response.content : ''
        return { content }
      })

      const { parseIntentWithLLM } = await import('../intent/parser.js')

      // 模糊表述，规则匹配可能置信度低
      const intent = await parseIntentWithLLM('我有个重要的事情要记住')
      expect(intent).toBeDefined()
      expect(intent.type).not.toBe('unknown')
    })

    it('应该通过 LLM 识别日程查询意图', async () => {
      if (!API_KEY) return

      const provider = new OpenAIProvider({
        apiKey: API_KEY,
        baseUrl: BASE_URL,
        model: 'gpt-4o-mini',
      })

      setLLMChat(async (messages, options) => {
        const response = await provider.chat(messages, options)
        const content = typeof response.content === 'string' ? response.content : ''
        return { content }
      })

      const { parseIntentWithLLM } = await import('../intent/parser.js')

      const intent = await parseIntentWithLLM('看看最近有什么安排')
      expect(intent).toBeDefined()
      expect(intent.type).not.toBe('unknown')
    })
  })
})