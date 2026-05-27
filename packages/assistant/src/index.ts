/**
 * @colomind/assistant - Personal Assistant Package
 *
 * Personal information management and intelligent assistance
 */

// Database
export { getDb, closeDb, generateId, type AssistantDbConfig } from './db/schema.js'

// Task Management
export {
  // Todos
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
  // Reminders
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
  // Time parsing
  parseTime,
  parseTimeRange,
  formatTime,
  type ParsedTime,
} from './task/index.js'

// Schedule Management
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

// Knowledge Management
export {
  // Notes
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
  // Bookmarks
  createBookmark,
  getBookmark,
  deleteBookmark,
  listBookmarks,
  searchBookmarks,
  type Bookmark,
  type CreateBookmarkInput,
} from './knowledge/index.js'

// Life Management
export {
  // Habits
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
  // Moods
  logMood,
  getMoodEntries,
  getDayMood,
  getMoodStats,
  type MoodEntry,
  type MoodType,
  // Finances
  logFinance,
  getFinanceEntries,
  getFinanceStats,
  getMonthlyStats,
  deleteFinanceEntry,
  type FinanceEntry,
  type FinanceType,
  type FinanceStats,
  // Health
  logHealth,
  logExercise,
  logSleep,
  logWeight,
  logWater,
  getHealthEntries,
  getHealthStats,
  type HealthEntry,
} from './life/index.js'

// Growth Management
export {
  // Learning
  createCourse,
  updateProgress,
  getCourse,
  listCourses,
  deleteCourse,
  type Course,
  // Reading
  addReading,
  updateReadingProgress,
  getReading,
  listReadings,
  deleteReading,
  type Reading,
  type ReadingType,
  type ReadingStatus,
  // Goals
  createGoal,
  updateGoalProgress,
  getGoal,
  listGoals,
  deleteGoal,
  type Goal,
  type GoalStatus,
  // Inspiration
  addInspiration,
  getInspiration,
  listInspirations,
  searchInspirations,
  deleteInspiration,
  type Inspiration,
} from './growth/index.js'

// Social Management
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

// Project Management
export {
  createProject,
  getProject,
  updateProject,
  listProjects,
  deleteProject,
  type Project,
  type ProjectStatus,
} from './project/index.js'

// Tools
export {
  // Password
  setEncryptionKey,
  createPasswordEntry,
  getPasswordEntry,
  getPassword,
  listPasswordEntries,
  updatePasswordEntry,
  deletePasswordEntry,
  generatePassword,
  type PasswordEntry,
  // Time tracking
  startTimeLog,
  endTimeLog,
  getTimeLog,
  getActiveTimeLogs,
  getTimeLogs,
  getTimeStats,
  deleteTimeLog,
  type TimeLog,
} from './tools/index.js'

// Intent Recognition
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

// Logger
export {
  createLogger,
  setLogLevel,
  getLogLevel,
  type Logger,
  type LogLevel,
} from './utils/logger.js'

// User Profile
export {
  generateUserProfile,
  getUserContext,
  type UserProfile,
  type PsychologicalProfile,
  type LifestyleProfile,
  type ProductivityProfile,
  type SocialProfile,
  type FinancialProfile,
  type HealthProfile,
  type GrowthProfile,
  type UserProfileInput,
} from './profile/index.js'
