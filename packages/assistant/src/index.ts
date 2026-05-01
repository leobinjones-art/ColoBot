/**
 * @colobot/assistant - 核心助理包
 *
 * 个人信息管理和智能辅助
 */

// 数据库
export { getDb, closeDb, generateId, type AssistantDbConfig } from './db/schema.js'

// 任务管理
export {
  // 待办
  createTodo,
  getTodo,
  updateTodo,
  deleteTodo,
  listTodos,
  getTodayTodos,
  completeTodo,
  type Todo,
  type TodoPriority,
  type TodoStatus,
  type CreateTodoInput,
  type UpdateTodoInput,
  type TodoFilter,
  // 提醒
  createReminder,
  getReminder,
  listReminders,
  getPendingReminders,
  completeReminder,
  cancelReminder,
  deleteReminder,
  onReminder,
  startReminderCheck,
  stopReminderCheck,
  createReminderFromText,
  type Reminder,
  type ReminderRepeat,
  type ReminderStatus,
  type CreateReminderInput,
  // 时间解析
  parseTime,
  parseTimeRange,
  formatTime,
  type ParsedTime,
} from './task/index.js'

// 日程管理
export {
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
  getDayEvents,
  getWeekEvents,
  getMonthEvents,
  checkConflict,
  type Event,
  type CreateEventInput,
} from './schedule/index.js'

// 知识管理
export {
  // 笔记
  createNote,
  getNote,
  updateNote,
  deleteNote,
  listNotes,
  searchNotes,
  getAllTags,
  type Note,
  type CreateNoteInput,
  type UpdateNoteInput,
  // 收藏
  createBookmark,
  getBookmark,
  deleteBookmark,
  listBookmarks,
  searchBookmarks,
  type Bookmark,
  type CreateBookmarkInput,
} from './knowledge/index.js'

// 生活管理
export {
  // 习惯
  createHabit,
  getHabit,
  listHabits,
  deleteHabit,
  checkHabit,
  getHabitLogs,
  getStreak,
  isTodayChecked,
  type Habit,
  type HabitLog,
  type HabitFrequency,
  // 心情
  logMood,
  getMoodEntries,
  getDayMood,
  getMoodStats,
  type MoodEntry,
  type MoodType,
  // 财务
  logFinance,
  getFinanceEntries,
  getFinanceStats,
  getMonthlyStats,
  deleteFinanceEntry,
  type FinanceEntry,
  type FinanceType,
  type FinanceStats,
  // 健康
  logHealth,
  logExercise,
  logSleep,
  logWeight,
  logWater,
  getHealthEntries,
  getHealthStats,
  type HealthEntry,
} from './life/index.js'

// 成长管理
export {
  // 学习
  createCourse,
  updateProgress,
  getCourse,
  listCourses,
  deleteCourse,
  type Course,
  // 阅读
  addReading,
  updateReadingProgress,
  getReading,
  listReadings,
  deleteReading,
  type Reading,
  type ReadingType,
  type ReadingStatus,
  // 目标
  createGoal,
  updateGoalProgress,
  getGoal,
  listGoals,
  deleteGoal,
  type Goal,
  type GoalStatus,
  // 灵感
  addInspiration,
  getInspiration,
  listInspirations,
  searchInspirations,
  deleteInspiration,
  type Inspiration,
} from './growth/index.js'

// 社交管理
export {
  createContact,
  getContact,
  updateContact,
  listContacts,
  searchContacts,
  deleteContact,
  recordInteraction,
  type Contact,
} from './social/index.js'

// 项目管理
export {
  createProject,
  getProject,
  updateProject,
  listProjects,
  deleteProject,
  type Project,
  type ProjectStatus,
} from './project/index.js'

// 工具
export {
  // 密码
  setEncryptionKey,
  createPasswordEntry,
  getPasswordEntry,
  getPassword,
  listPasswordEntries,
  updatePasswordEntry,
  deletePasswordEntry,
  generatePassword,
  type PasswordEntry,
  // 时间追踪
  startTimeLog,
  endTimeLog,
  getTimeLog,
  getActiveTimeLogs,
  getTimeLogs,
  getTimeStats,
  deleteTimeLog,
  type TimeLog,
} from './tools/index.js'

// 意图识别
export {
  parseIntent,
  parseIntentWithLLM,
  setLLMChat,
  getLLMChat,
  createIntentHandler,
  type IntentType,
  type Intent,
  type IntentAction,
} from './intent/index.js'

// 日志工具
export { createLogger, setLogLevel, getLogLevel, type Logger, type LogLevel } from './utils/logger.js'
