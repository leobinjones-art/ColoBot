/**
 * 用户画像分析服务
 * 整合所有用户数据，生成全面的用户画像
 */

import { createLogger } from '../utils/logger.js'
import type { MoodEntry, MoodType } from '../life/mood.js'
import type { Habit, HabitLog } from '../life/habit.js'
import type { FinanceEntry } from '../life/finance.js'
import type { HealthEntry } from '../life/health.js'
import type { Todo, TodoPriority } from '../task/todo.js'
import type { Goal, GoalStatus } from '../growth/goal.js'
import type { Contact } from '../social/contact.js'
import type { Note } from '../knowledge/note.js'
import type { Event } from '../schedule/event.js'

const logger = createLogger('UserProfile')

// ==================== 类型定义 ====================

export interface UserProfile {
  // 基础信息
  userId: string
  profileVersion: string
  generatedAt: string

  // 心理状态
  psychological: PsychologicalProfile

  // 生活习惯
  lifestyle: LifestyleProfile

  // 工作效率
  productivity: ProductivityProfile

  // 社交关系
  social: SocialProfile

  // 财务状况
  financial: FinancialProfile

  // 健康状况
  health: HealthProfile

  // 成长目标
  growth: GrowthProfile

  // AI 可用上下文
  aiContext: string
}

export interface PsychologicalProfile {
  overallScore: number // 0-100
  status: 'excellent' | 'good' | 'normal' | 'concerning' | 'warning'
  dominantMood: MoodType
  moodDistribution: Record<MoodType, number>
  trend: 'improving' | 'stable' | 'declining' | 'fluctuating'
  streakDays: number
  riskLevel: 'none' | 'low' | 'medium' | 'high'
  riskFactors: string[]
  insights: string[]
}

export interface LifestyleProfile {
  habitCount: number
  activeHabits: number
  totalStreak: number
  bestStreak: number
  consistency: 'high' | 'medium' | 'low'
  topHabits: Array<{ name: string; streak: number }>
  checkInRate: number // 0-100
  insights: string[]
}

export interface ProductivityProfile {
  totalTodos: number
  completedTodos: number
  completionRate: number // 0-100
  overdueCount: number
  highPriorityPending: number
  averageCompletionTime?: number // hours
  productiveHours: number[] // 0-23
  insights: string[]
}

export interface SocialProfile {
  totalContacts: number
  recentInteractions: number
  topContacts: Array<{ name: string; lastContact: string }>
  relationshipHealth: 'active' | 'moderate' | 'inactive'
  insights: string[]
}

export interface FinancialProfile {
  totalIncome: number
  totalExpense: number
  balance: number
  savingsRate: number // 0-100
  topCategories: Array<{ category: string; amount: number }>
  spendingTrend: 'increasing' | 'stable' | 'decreasing'
  insights: string[]
}

export interface HealthProfile {
  latestWeight?: number
  sleepAverage?: number
  exerciseFrequency: number // per week
  waterIntakeAverage?: number
  healthScore: number // 0-100
  insights: string[]
}

export interface GrowthProfile {
  activeGoals: number
  completedGoals: number
  averageProgress: number // 0-100
  nearDeadlineGoals: number
  readingProgress: number
  courseProgress: number
  insights: string[]
}

// ==================== 分析函数 ====================

export interface UserProfileInput {
  moods: MoodEntry[]
  habits: Array<Habit & { logs?: HabitLog[]; streak?: number }>
  todos: Todo[]
  goals: Goal[]
  contacts: Contact[]
  finances: FinanceEntry[]
  healthEntries: HealthEntry[]
  notes: Note[]
  events: Event[]
}

/**
 * 生成用户画像
 */
export function generateUserProfile(userId: string, data: UserProfileInput): UserProfile {
  logger.info('Generating user profile', { userId })

  const psychological = analyzePsychological(data.moods)
  const lifestyle = analyzeLifestyle(data.habits)
  const productivity = analyzeProductivity(data.todos)
  const social = analyzeSocial(data.contacts)
  const financial = analyzeFinancial(data.finances)
  const health = analyzeHealth(data.healthEntries)
  const growth = analyzeGrowth(data.goals)

  const aiContext = generateAIContext({
    userId,
    psychological,
    lifestyle,
    productivity,
    social,
    financial,
    health,
    growth,
  })

  return {
    userId,
    profileVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    psychological,
    lifestyle,
    productivity,
    social,
    financial,
    health,
    growth,
    aiContext,
  }
}

// ==================== 心理分析 ====================

function analyzePsychological(moods: MoodEntry[]): PsychologicalProfile {
  if (moods.length === 0) {
    return {
      overallScore: 50,
      status: 'normal',
      dominantMood: 'neutral',
      moodDistribution: {} as Record<MoodType, number>,
      trend: 'stable',
      streakDays: 0,
      riskLevel: 'none',
      riskFactors: [],
      insights: ['暂无心情记录，建议开始记录以了解自己的情绪状态'],
    }
  }

  // 心情分布
  const distribution: Record<MoodType, number> = {} as Record<MoodType, number>
  moods.forEach((m) => {
    distribution[m.mood] = (distribution[m.mood] || 0) + 1
  })

  // 主导心情
  let dominantMood: MoodType = 'neutral'
  let maxCount = 0
  Object.entries(distribution).forEach(([mood, count]) => {
    if (count > maxCount) {
      maxCount = count
      dominantMood = mood as MoodType
    }
  })

  // 整体分数
  const avgScore = moods.reduce((s, m) => s + m.score, 0) / moods.length
  const overallScore = Math.round(avgScore * 10)

  // 趋势分析
  const recent = moods.slice(0, Math.min(7, moods.length))
  const older = moods.slice(Math.min(7, moods.length), Math.min(14, moods.length))
  const recentAvg = recent.reduce((s, m) => s + m.score, 0) / recent.length
  const olderAvg =
    older.length > 0 ? older.reduce((s, m) => s + m.score, 0) / older.length : recentAvg
  const diff = recentAvg - olderAvg

  let trend: 'improving' | 'stable' | 'declining' | 'fluctuating' = 'stable'
  const variance = recent.reduce((s, m) => s + Math.pow(m.score - recentAvg, 2), 0) / recent.length
  if (Math.sqrt(variance) > 2.5) trend = 'fluctuating'
  else if (diff > 1) trend = 'improving'
  else if (diff < -1) trend = 'declining'

  // 连续记录天数
  const streakDays = calculateMoodStreak(moods)

  // 风险评估
  const { riskLevel, riskFactors } = assessPsychologicalRisk(moods, trend)

  // 状态
  let status: 'excellent' | 'good' | 'normal' | 'concerning' | 'warning' = 'normal'
  if (riskLevel === 'high') status = 'warning'
  else if (riskLevel === 'medium') status = 'concerning'
  else if (overallScore >= 80) status = 'excellent'
  else if (overallScore >= 60) status = 'good'

  // 洞察
  const insights = generatePsychologicalInsights({
    overallScore,
    trend,
    dominantMood,
    streakDays,
    riskLevel,
  })

  return {
    overallScore,
    status,
    dominantMood,
    moodDistribution: distribution,
    trend,
    streakDays,
    riskLevel,
    riskFactors,
    insights,
  }
}

function calculateMoodStreak(moods: MoodEntry[]): number {
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)
    const hasMood = moods.some((m) => {
      const mDate = new Date(m.loggedAt)
      mDate.setHours(0, 0, 0, 0)
      return mDate.getTime() === checkDate.getTime()
    })
    if (hasMood) streak++
    else break
  }
  return streak
}

function assessPsychologicalRisk(
  moods: MoodEntry[],
  trend: string,
): { riskLevel: 'none' | 'low' | 'medium' | 'high'; riskFactors: string[] } {
  const riskFactors: string[] = []
  let riskScore = 0

  if (trend === 'declining') {
    riskScore += 2
    riskFactors.push('心情呈下降趋势')
  } else if (trend === 'fluctuating') {
    riskScore += 1
    riskFactors.push('心情波动较大')
  }

  const recentLow = moods.slice(0, 7).filter((m) => m.score <= 3).length
  if (recentLow >= 5) {
    riskScore += 3
    riskFactors.push('最近一周大部分时间心情低落')
  } else if (recentLow >= 3) {
    riskScore += 1
    riskFactors.push('最近一周有较多低落时刻')
  }

  const negativeMoods = moods
    .slice(0, 14)
    .filter((m) => ['sad', 'angry', 'anxious'].includes(m.mood)).length
  if (negativeMoods >= 10) {
    riskScore += 2
    riskFactors.push('负面情绪占比较高')
  }

  let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'none'
  if (riskScore >= 5) riskLevel = 'high'
  else if (riskScore >= 3) riskLevel = 'medium'
  else if (riskScore >= 1) riskLevel = 'low'

  return { riskLevel, riskFactors }
}

function generatePsychologicalInsights(ctx: {
  overallScore: number
  trend: string
  dominantMood: MoodType
  streakDays: number
  riskLevel: string
}): string[] {
  const insights: string[] = []

  if (ctx.overallScore >= 80) {
    insights.push('心理状态良好，继续保持积极的生活态度')
  } else if (ctx.overallScore <= 40) {
    insights.push('最近心理状态需要关注，建议多与朋友交流或进行户外活动')
  }

  if (ctx.trend === 'improving') {
    insights.push('心情在逐渐好转，这是一个积极的信号')
  } else if (ctx.trend === 'declining') {
    insights.push('心情有所下降，可以尝试调整生活节奏')
  }

  if (ctx.streakDays >= 7) {
    insights.push(`已连续记录心情${ctx.streakDays}天，自我觉察力在提升`)
  }

  if (ctx.riskLevel === 'high') {
    insights.push('如果持续感到困扰，建议寻求专业帮助')
  }

  return insights
}

// ==================== 生活习惯分析 ====================

function analyzeLifestyle(
  habits: Array<Habit & { logs?: HabitLog[]; streak?: number }>,
): LifestyleProfile {
  if (habits.length === 0) {
    return {
      habitCount: 0,
      activeHabits: 0,
      totalStreak: 0,
      bestStreak: 0,
      consistency: 'low',
      topHabits: [],
      checkInRate: 0,
      insights: ['暂无习惯记录，建议创建一些日常习惯来改善生活质量'],
    }
  }

  const activeHabits = habits.filter((h) => h.streak && h.streak > 0).length
  const totalStreak = habits.reduce((s, h) => s + (h.streak || 0), 0)
  const bestStreak = Math.max(...habits.map((h) => h.streak || 0), 0)

  const topHabits = habits
    .filter((h) => h.streak && h.streak > 0)
    .sort((a, b) => (b.streak || 0) - (a.streak || 0))
    .slice(0, 3)
    .map((h) => ({ name: h.name, streak: h.streak || 0 }))

  // 打卡率（最近7天）
  const checkInRate = Math.min(100, Math.round((activeHabits / habits.length) * 100))

  let consistency: 'high' | 'medium' | 'low' = 'low'
  if (checkInRate >= 80) consistency = 'high'
  else if (checkInRate >= 50) consistency = 'medium'

  const insights: string[] = []
  if (bestStreak >= 30) {
    insights.push(`最长连续打卡${bestStreak}天，习惯养成能力很强`)
  } else if (bestStreak >= 7) {
    insights.push(`已有习惯坚持超过一周，继续保持`)
  }
  if (consistency === 'high') {
    insights.push('习惯坚持度很高，自律能力优秀')
  } else if (consistency === 'low') {
    insights.push('习惯坚持度有待提高，可以从小目标开始')
  }

  return {
    habitCount: habits.length,
    activeHabits,
    totalStreak,
    bestStreak,
    consistency,
    topHabits,
    checkInRate,
    insights,
  }
}

// ==================== 工作效率分析 ====================

function analyzeProductivity(todos: Todo[]): ProductivityProfile {
  if (todos.length === 0) {
    return {
      totalTodos: 0,
      completedTodos: 0,
      completionRate: 0,
      overdueCount: 0,
      highPriorityPending: 0,
      productiveHours: [],
      insights: ['暂无待办记录，建议开始规划任务'],
    }
  }

  const completedTodos = todos.filter((t) => t.status === 'done').length
  const completionRate = Math.round((completedTodos / todos.length) * 100)

  const now = new Date()
  const overdueCount = todos.filter(
    (t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now,
  ).length

  const highPriorityPending = todos.filter(
    (t) => t.status !== 'done' && t.priority === 'high',
  ).length

  const insights: string[] = []
  if (completionRate >= 80) {
    insights.push('任务完成率很高，工作效率优秀')
  } else if (completionRate >= 50) {
    insights.push('任务完成率良好，可以尝试优化优先级管理')
  } else {
    insights.push('任务完成率较低，建议减少任务数量或分解大任务')
  }

  if (overdueCount > 3) {
    insights.push(`有${overdueCount}个任务已逾期，建议重新评估优先级`)
  }
  if (highPriorityPending > 5) {
    insights.push('高优先级任务较多，建议合理分配精力')
  }

  return {
    totalTodos: todos.length,
    completedTodos,
    completionRate,
    overdueCount,
    highPriorityPending,
    productiveHours: [],
    insights,
  }
}

// ==================== 社交分析 ====================

function analyzeSocial(contacts: Contact[]): SocialProfile {
  if (contacts.length === 0) {
    return {
      totalContacts: 0,
      recentInteractions: 0,
      topContacts: [],
      relationshipHealth: 'inactive',
      insights: ['暂无人脉记录，建议开始建立社交网络'],
    }
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const recentInteractions = contacts.filter(
    (c) => c.lastContact && new Date(c.lastContact) >= thirtyDaysAgo,
  ).length

  const topContacts = contacts
    .filter((c) => c.lastContact)
    .sort((a, b) => new Date(b.lastContact!).getTime() - new Date(a.lastContact!).getTime())
    .slice(0, 5)
    .map((c) => ({ name: c.name, lastContact: c.lastContact! }))

  let relationshipHealth: 'active' | 'moderate' | 'inactive' = 'inactive'
  if (recentInteractions >= 5) relationshipHealth = 'active'
  else if (recentInteractions >= 2) relationshipHealth = 'moderate'

  const insights: string[] = []
  if (relationshipHealth === 'active') {
    insights.push('社交活动活跃，人际关系良好')
  } else if (relationshipHealth === 'inactive') {
    insights.push('最近社交活动较少，可以主动联系朋友')
  }

  return {
    totalContacts: contacts.length,
    recentInteractions,
    topContacts,
    relationshipHealth,
    insights,
  }
}

// ==================== 财务分析 ====================

function analyzeFinancial(finances: FinanceEntry[]): FinancialProfile {
  if (finances.length === 0) {
    return {
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      savingsRate: 0,
      topCategories: [],
      spendingTrend: 'stable',
      insights: ['暂无财务记录，建议开始记账以了解消费习惯'],
    }
  }

  const totalIncome = finances.filter((f) => f.type === 'income').reduce((s, f) => s + f.amount, 0)

  const totalExpense = finances
    .filter((f) => f.type === 'expense')
    .reduce((s, f) => s + f.amount, 0)

  const balance = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0

  // 分类统计
  const categoryTotals: Record<string, number> = {}
  finances
    .filter((f) => f.type === 'expense')
    .forEach((f) => {
      const cat = f.category || '其他'
      categoryTotals[cat] = (categoryTotals[cat] || 0) + f.amount
    })

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount }))

  const insights: string[] = []
  if (savingsRate >= 30) {
    insights.push(`储蓄率${savingsRate}%，财务状况良好`)
  } else if (savingsRate < 0) {
    insights.push('支出超过收入，建议审视消费习惯')
  }

  if (topCategories.length > 0) {
    insights.push(
      `主要支出在${topCategories[0].category}，占比${Math.round((topCategories[0].amount / totalExpense) * 100)}%`,
    )
  }

  return {
    totalIncome,
    totalExpense,
    balance,
    savingsRate,
    topCategories,
    spendingTrend: 'stable',
    insights,
  }
}

// ==================== 健康分析 ====================

function analyzeHealth(healthEntries: HealthEntry[]): HealthProfile {
  if (healthEntries.length === 0) {
    return {
      exerciseFrequency: 0,
      healthScore: 50,
      insights: ['暂无健康记录，建议开始追踪健康数据'],
    }
  }

  const weights = healthEntries.filter((h) => h.weight)
  const sleeps = healthEntries.filter((h) => h.sleepHours)
  const exercises = healthEntries.filter((h) => h.exercise)
  const waters = healthEntries.filter((h) => h.water)

  const latestWeight = weights.length > 0 ? weights[weights.length - 1].weight : undefined
  const sleepAverage =
    sleeps.length > 0
      ? sleeps.reduce((s, h) => s + (h.sleepHours || 0), 0) / sleeps.length
      : undefined
  const waterIntakeAverage =
    waters.length > 0 ? waters.reduce((s, h) => s + (h.water || 0), 0) / waters.length : undefined

  // 最近一周运动次数
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const exerciseFrequency = exercises.filter((h) => new Date(h.loggedAt) >= weekAgo).length

  // 健康分数
  let healthScore = 50
  if (sleepAverage && sleepAverage >= 7 && sleepAverage <= 9) healthScore += 15
  else if (sleepAverage && sleepAverage >= 6) healthScore += 5
  if (exerciseFrequency >= 3) healthScore += 15
  else if (exerciseFrequency >= 1) healthScore += 5
  if (waterIntakeAverage && waterIntakeAverage >= 2000) healthScore += 10
  healthScore = Math.min(100, healthScore)

  const insights: string[] = []
  if (sleepAverage && sleepAverage < 6) {
    insights.push(`平均睡眠${sleepAverage.toFixed(1)}小时，建议增加睡眠时间`)
  } else if (sleepAverage && sleepAverage >= 7) {
    insights.push('睡眠时间充足，继续保持')
  }
  if (exerciseFrequency < 2) {
    insights.push('运动频率较低，建议每周至少运动3次')
  } else {
    insights.push('运动习惯良好')
  }

  return {
    latestWeight,
    sleepAverage,
    exerciseFrequency,
    waterIntakeAverage,
    healthScore,
    insights,
  }
}

// ==================== 成长分析 ====================

function analyzeGrowth(goals: Goal[]): GrowthProfile {
  const activeGoals = goals.filter((g) => g.status === 'active').length
  const completedGoals = goals.filter((g) => g.status === 'completed').length

  const activeGoalsList = goals.filter((g) => g.status === 'active')
  const averageProgress =
    activeGoalsList.length > 0
      ? activeGoalsList.reduce((s, g) => s + g.progress, 0) / activeGoalsList.length
      : 0

  const now = new Date()
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const nearDeadlineGoals = activeGoalsList.filter(
    (g) => g.targetDate && new Date(g.targetDate) <= weekLater,
  ).length

  const insights: string[] = []
  if (completedGoals > 0) {
    insights.push(`已完成${completedGoals}个目标，继续努力`)
  }
  if (nearDeadlineGoals > 0) {
    insights.push(`有${nearDeadlineGoals}个目标即将到期，请关注进度`)
  }
  if (averageProgress >= 70) {
    insights.push('目标进度良好，保持动力')
  } else if (averageProgress < 30 && activeGoals > 0) {
    insights.push('目标进度较慢，可以分解为更小的步骤')
  }

  return {
    activeGoals,
    completedGoals,
    averageProgress: Math.round(averageProgress),
    nearDeadlineGoals,
    readingProgress: 0,
    courseProgress: 0,
    insights,
  }
}

// ==================== AI 上下文生成 ====================

function generateAIContext(profile: {
  userId: string
  psychological: PsychologicalProfile
  lifestyle: LifestyleProfile
  productivity: ProductivityProfile
  social: SocialProfile
  financial: FinancialProfile
  health: HealthProfile
  growth: GrowthProfile
}): string {
  const parts: string[] = []

  parts.push(`## 用户画像 (${profile.userId})`)
  parts.push('')

  // 心理状态
  parts.push('### 心理状态')
  parts.push(
    `- 整体评分：${profile.psychological.overallScore}/100 (${profile.psychological.status})`,
  )
  parts.push(`- 趋势：${profile.psychological.trend}`)
  parts.push(`- 主导情绪：${profile.psychological.dominantMood}`)
  if (profile.psychological.riskLevel !== 'none') {
    parts.push(`- ⚠️ 风险等级：${profile.psychological.riskLevel}`)
    if (profile.psychological.riskFactors.length > 0) {
      parts.push(`- 风险因素：${profile.psychological.riskFactors.join('、')}`)
    }
  }
  parts.push('')

  // 生活习惯
  parts.push('### 生活习惯')
  parts.push(`- 习惯数量：${profile.lifestyle.habitCount}`)
  parts.push(`- 活跃习惯：${profile.lifestyle.activeHabits}`)
  parts.push(`- 最长连续：${profile.lifestyle.bestStreak}天`)
  parts.push(`- 打卡率：${profile.lifestyle.checkInRate}%`)
  parts.push('')

  // 工作效率
  parts.push('### 工作效率')
  parts.push(`- 任务总数：${profile.productivity.totalTodos}`)
  parts.push(`- 完成率：${profile.productivity.completionRate}%`)
  parts.push(`- 逾期任务：${profile.productivity.overdueCount}`)
  parts.push(`- 高优先级待办：${profile.productivity.highPriorityPending}`)
  parts.push('')

  // 社交
  parts.push('### 社交关系')
  parts.push(`- 联系人：${profile.social.totalContacts}`)
  parts.push(`- 近期互动：${profile.social.recentInteractions}`)
  parts.push(`- 社交活跃度：${profile.social.relationshipHealth}`)
  parts.push('')

  // 财务
  parts.push('### 财务状况')
  parts.push(`- 收入：${profile.financial.totalIncome}`)
  parts.push(`- 支出：${profile.financial.totalExpense}`)
  parts.push(`- 结余：${profile.financial.balance}`)
  parts.push(`- 储蓄率：${profile.financial.savingsRate}%`)
  parts.push('')

  // 健康
  parts.push('### 健康状况')
  parts.push(`- 健康分数：${profile.health.healthScore}/100`)
  if (profile.health.sleepAverage) {
    parts.push(`- 平均睡眠：${profile.health.sleepAverage.toFixed(1)}小时`)
  }
  parts.push(`- 本周运动：${profile.health.exerciseFrequency}次`)
  parts.push('')

  // 成长
  parts.push('### 成长目标')
  parts.push(`- 进行中目标：${profile.growth.activeGoals}`)
  parts.push(`- 已完成目标：${profile.growth.completedGoals}`)
  parts.push(`- 平均进度：${profile.growth.averageProgress}%`)
  parts.push('')

  // 关键洞察
  parts.push('### 关键洞察')
  const allInsights = [
    ...profile.psychological.insights,
    ...profile.lifestyle.insights,
    ...profile.productivity.insights,
    ...profile.social.insights,
    ...profile.financial.insights,
    ...profile.health.insights,
    ...profile.growth.insights,
  ].slice(0, 5)
  allInsights.forEach((insight) => parts.push(`- ${insight}`))

  return parts.join('\n')
}
