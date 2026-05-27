/**
 * Assistant 数据库行类型定义
 *
 * 从 schema.ts 的 CREATE TABLE 语句推导，消除 row: any
 */

export interface TodoRow {
  id: string
  user_id: string
  title: string
  description: string | null
  priority: string
  status: string
  due_date: string | null
  tags: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface ReminderRow {
  id: string
  user_id: string
  title: string
  content: string | null
  remind_at: string
  repeat: string | null
  status: string
  created_at: string
}

export interface EventRow {
  id: string
  user_id: string
  title: string
  description: string | null
  start_at: string
  end_at: string | null
  location: string | null
  repeat: string | null
  created_at: string
}

export interface NoteRow {
  id: string
  user_id: string
  title: string
  content: string | null
  tags: string | null
  created_at: string
  updated_at: string
}

export interface BookmarkRow {
  id: string
  user_id: string
  url: string
  title: string
  summary: string | null
  tags: string | null
  created_at: string
}

export interface HabitRow {
  id: string
  user_id: string
  name: string
  frequency: string
  created_at: string
}

export interface HabitLogRow {
  id: string
  habit_id: string
  logged_at: string
  note: string | null
}

export interface MoodRow {
  id: string
  user_id: string
  mood: string
  score: number | null
  note: string | null
  logged_at: string
}

export interface FinanceRow {
  id: string
  user_id: string
  type: string
  amount: number
  category: string | null
  note: string | null
  logged_at: string
}

export interface GoalRow {
  id: string
  user_id: string
  title: string
  description: string | null
  target_date: string | null
  progress: number
  status: string
  created_at: string
}

export interface ReadingRow {
  id: string
  user_id: string
  title: string
  author: string | null
  type: string | null
  status: string
  progress: number
  note: string | null
  created_at: string
}

export interface ContactRow {
  id: string
  user_id: string
  name: string
  organization: string | null
  role: string | null
  email: string | null
  phone: string | null
  tags: string | null
  last_contact: string | null
  note: string | null
  created_at: string
}

export interface ProjectRow {
  id: string
  user_id: string
  name: string
  description: string | null
  status: string
  progress: number
  created_at: string
}

export interface InspirationRow {
  id: string
  user_id: string
  content: string
  tags: string | null
  created_at: string
}

export interface TimeLogRow {
  id: string
  user_id: string
  activity: string
  category: string | null
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  note: string | null
}

export interface PasswordRow {
  id: string
  user_id: string
  name: string
  username: string | null
  encrypted_password: string
  url: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface HealthRow {
  id: string
  user_id: string
  type: string
  value: number
  unit: string
  note: string | null
  logged_at: string
}

export interface CourseRow {
  id: string
  user_id: string
  name: string
  total_hours: number
  completed_hours: number
  status: string
  created_at: string
}
