/**
 * 心情分析服务
 * 根据心情记录分析用户心理状态，提供智能建议
 */

export interface MoodAnalysis {
  // 整体状态
  overallStatus: 'excellent' | 'good' | 'normal' | 'concerning' | 'warning'
  overallScore: number // 1-100

  // 趋势分析
  trend: 'improving' | 'stable' | 'declining' | 'fluctuating'
  trendDescription: string

  // 情绪分布
  dominantMood: string
  moodDistribution: Record<string, number>

  // 连续性
  streakDays: number
  consistency: 'high' | 'medium' | 'low'

  // 模式识别
  patterns: MoodPattern[]

  // 建议
  suggestions: MoodSuggestion[]

  // 风险提示
  riskLevel: 'none' | 'low' | 'medium' | 'high'
  riskFactors: string[]
}

export interface MoodPattern {
  type: 'weekday' | 'time' | 'sequence' | 'trigger'
  description: string
  insight: string
}

export interface MoodSuggestion {
  type: 'activity' | 'mindset' | 'social' | 'professional' | 'health'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  actionable: string
}

export interface MoodRecord {
  mood: string
  score: number
  note?: string
  loggedAt: string
}

// 心情权重
const MOOD_WEIGHTS: Record<string, number> = {
  happy: 10,
  neutral: 5,
  sad: 2,
  angry: 1,
  anxious: 3,
}

// 心情中文名
const MOOD_NAMES: Record<string, string> = {
  happy: '开心',
  neutral: '平静',
  sad: '难过',
  angry: '生气',
  anxious: '焦虑',
}

/**
 * 分析用户心情数据
 */
export function analyzeMoods(moods: MoodRecord[]): MoodAnalysis {
  if (moods.length === 0) {
    return getEmptyAnalysis()
  }

  const sortedMoods = [...moods].sort((a, b) =>
    new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
  )

  // 计算整体分数
  const overallScore = calculateOverallScore(sortedMoods)

  // 分析趋势
  const trend = analyzeTrend(sortedMoods)

  // 心情分布
  const moodDistribution = analyzeDistribution(sortedMoods)
  const dominantMood = getDominantMood(moodDistribution)

  // 连续性分析
  const streakDays = calculateStreak(sortedMoods)
  const consistency = analyzeConsistency(sortedMoods, streakDays)

  // 模式识别
  const patterns = identifyPatterns(sortedMoods)

  // 风险评估
  const { riskLevel, riskFactors } = assessRisk(sortedMoods, trend, patterns)

  // 生成建议
  const suggestions = generateSuggestions({
    overallScore,
    trend,
    dominantMood,
    streakDays,
    consistency,
    patterns,
    riskLevel,
  })

  // 整体状态
  const overallStatus = getOverallStatus(overallScore, riskLevel)

  return {
    overallStatus,
    overallScore,
    trend,
    trendDescription: getTrendDescription(trend, overallScore),
    dominantMood,
    moodDistribution,
    streakDays,
    consistency,
    patterns,
    suggestions,
    riskLevel,
    riskFactors,
  }
}

function getEmptyAnalysis(): MoodAnalysis {
  return {
    overallStatus: 'normal',
    overallScore: 50,
    trend: 'stable',
    trendDescription: '暂无足够数据进行分析',
    dominantMood: 'neutral',
    moodDistribution: {},
    streakDays: 0,
    consistency: 'low',
    patterns: [],
    suggestions: [{
      type: 'activity',
      priority: 'medium',
      title: '开始记录心情',
      description: '记录心情可以帮助你更好地了解自己',
      actionable: '每天花一分钟记录今天的心情',
    }],
    riskLevel: 'none',
    riskFactors: [],
  }
}

function calculateOverallScore(moods: MoodRecord[]): number {
  if (moods.length === 0) return 50

  // 加权平均，最近的心情权重更高
  const weights = moods.map((_, idx) => Math.exp(-idx * 0.1)) // 指数衰减权重
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  const weightedSum = moods.reduce((sum, mood, idx) => {
    const moodScore = MOOD_WEIGHTS[mood.mood] || 5
    const adjustedScore = moodScore * (mood.score / 5) // 根据程度调整
    return sum + adjustedScore * weights[idx]
  }, 0)

  const rawScore = weightedSum / totalWeight
  return Math.round(rawScore * 10) // 转换为 0-100
}

function analyzeTrend(moods: MoodRecord[]): 'improving' | 'stable' | 'declining' | 'fluctuating' {
  if (moods.length < 3) return 'stable'

  const recent = moods.slice(0, Math.min(5, moods.length))
  const older = moods.slice(Math.min(5, moods.length), Math.min(10, moods.length))

  if (older.length === 0) return 'stable'

  const recentAvg = recent.reduce((s, m) => s + m.score, 0) / recent.length
  const olderAvg = older.reduce((s, m) => s + m.score, 0) / older.length

  const diff = recentAvg - olderAvg

  // 计算波动性
  const scores = recent.map(m => m.score)
  const variance = scores.reduce((s, v) => s + Math.pow(v - recentAvg, 2), 0) / scores.length
  const stdDev = Math.sqrt(variance)

  if (stdDev > 2.5) return 'fluctuating'
  if (diff > 1) return 'improving'
  if (diff < -1) return 'declining'
  return 'stable'
}

function analyzeDistribution(moods: MoodRecord[]): Record<string, number> {
  const distribution: Record<string, number> = {}

  moods.forEach(m => {
    distribution[m.mood] = (distribution[m.mood] || 0) + 1
  })

  // 转换为百分比
  const total = moods.length
  Object.keys(distribution).forEach(key => {
    distribution[key] = Math.round((distribution[key] / total) * 100)
  })

  return distribution
}

function getDominantMood(distribution: Record<string, number>): string {
  let maxMood = 'neutral'
  let maxCount = 0

  Object.entries(distribution).forEach(([mood, count]) => {
    if (count > maxCount) {
      maxCount = count
      maxMood = mood
    }
  })

  return MOOD_NAMES[maxMood] || maxMood
}

function calculateStreak(moods: MoodRecord[]): number {
  if (moods.length === 0) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)

    const hasMood = moods.some(m => {
      const mDate = new Date(m.loggedAt)
      mDate.setHours(0, 0, 0, 0)
      return mDate.getTime() === checkDate.getTime()
    })

    if (hasMood) streak++
    else break
  }

  return streak
}

function analyzeConsistency(moods: MoodRecord[], streak: number): 'high' | 'medium' | 'low' {
  if (moods.length < 7) return 'low'

  const daysWithMoods = new Set(
    moods.map(m => new Date(m.loggedAt).toDateString())
  ).size

  const last30Days = Math.min(30, daysWithMoods)
  const expectedDays = Math.min(30, moods.length > 30 ? 30 : moods.length)

  const ratio = last30Days / expectedDays

  if (ratio >= 0.8 || streak >= 14) return 'high'
  if (ratio >= 0.5 || streak >= 7) return 'medium'
  return 'low'
}

function identifyPatterns(moods: MoodRecord[]): MoodPattern[] {
  const patterns: MoodPattern[] = []

  if (moods.length < 7) return patterns

  // 星期几模式
  const weekdayMoods: Record<number, { total: number; count: number }> = {}
  moods.forEach(m => {
    const day = new Date(m.loggedAt).getDay()
    if (!weekdayMoods[day]) weekdayMoods[day] = { total: 0, count: 0 }
    weekdayMoods[day].total += m.score
    weekdayMoods[day].count++
  })

  const weekdayAvg = Object.entries(weekdayMoods).map(([day, data]) => ({
    day: parseInt(day),
    avg: data.total / data.count,
  }))

  const bestDay = weekdayAvg.sort((a, b) => b.avg - a.avg)[0]
  const worstDay = weekdayAvg.sort((a, b) => a.avg - b.avg)[0]

  if (bestDay && worstDay && bestDay.avg - worstDay.avg > 1.5) {
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    patterns.push({
      type: 'weekday',
      description: `${dayNames[bestDay.day]}心情最好，${dayNames[worstDay.day]}心情较低`,
      insight: bestDay.day === 0 || bestDay.day === 6
        ? '周末更放松，注意工作日调节'
        : '可以考虑在低落的日子安排一些喜欢的活动',
    })
  }

  // 连续低落模式
  let consecutiveLow = 0
  let maxConsecutiveLow = 0
  moods.slice(0, 14).forEach(m => {
    if (m.score <= 4) {
      consecutiveLow++
      maxConsecutiveLow = Math.max(maxConsecutiveLow, consecutiveLow)
    } else {
      consecutiveLow = 0
    }
  })

  if (maxConsecutiveLow >= 3) {
    patterns.push({
      type: 'sequence',
      description: `近期有连续${maxConsecutiveLow}天心情低落`,
      insight: '持续低落可能需要关注，建议与朋友交流或进行户外活动',
    })
  }

  // 焦虑模式
  const anxiousCount = moods.slice(0, 10).filter(m => m.mood === 'anxious').length
  if (anxiousCount >= 4) {
    patterns.push({
      type: 'trigger',
      description: '近期焦虑情绪较多',
      insight: '焦虑时可以尝试深呼吸、冥想或散步来缓解',
    })
  }

  return patterns
}

function assessRisk(
  moods: MoodRecord[],
  trend: string,
  patterns: MoodPattern[]
): { riskLevel: 'none' | 'low' | 'medium' | 'high'; riskFactors: string[] } {
  const riskFactors: string[] = []
  let riskScore = 0

  // 趋势风险
  if (trend === 'declining') {
    riskScore += 2
    riskFactors.push('心情呈下降趋势')
  } else if (trend === 'fluctuating') {
    riskScore += 1
    riskFactors.push('心情波动较大')
  }

  // 连续低落风险
  const recentLow = moods.slice(0, 7).filter(m => m.score <= 3).length
  if (recentLow >= 5) {
    riskScore += 3
    riskFactors.push('最近一周大部分时间心情低落')
  } else if (recentLow >= 3) {
    riskScore += 1
    riskFactors.push('最近一周有较多低落时刻')
  }

  // 模式风险
  const hasConsecutiveLowPattern = patterns.some(p =>
    p.type === 'sequence' && p.description.includes('连续')
  )
  if (hasConsecutiveLowPattern) {
    riskScore += 2
  }

  // 负面情绪占比
  const negativeMoods = moods.slice(0, 14).filter(m =>
    ['sad', 'angry', 'anxious'].includes(m.mood)
  ).length
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

function generateSuggestions(context: {
  overallScore: number
  trend: string
  dominantMood: string
  streakDays: number
  consistency: string
  patterns: MoodPattern[]
  riskLevel: string
}): MoodSuggestion[] {
  const suggestions: MoodSuggestion[] = []

  // 基于整体分数
  if (context.overallScore >= 80) {
    suggestions.push({
      type: 'mindset',
      priority: 'low',
      title: '保持积极心态',
      description: '你最近状态很好，继续保持！',
      actionable: '记录下让你开心的事情，感恩生活中的美好',
    })
  } else if (context.overallScore <= 40) {
    suggestions.push({
      type: 'health',
      priority: 'high',
      title: '关注心理健康',
      description: '最近心情不太好，建议多关注自己的感受',
      actionable: '尝试每天做一件让自己开心的小事',
    })
  }

  // 基于趋势
  if (context.trend === 'declining') {
    suggestions.push({
      type: 'activity',
      priority: 'high',
      title: '调整生活节奏',
      description: '心情有下降趋势，可能需要调整',
      actionable: '增加运动、社交或做自己喜欢的事',
    })
  } else if (context.trend === 'improving') {
    suggestions.push({
      type: 'mindset',
      priority: 'low',
      title: '继续保持',
      description: '心情在好转，继续保持当前状态',
      actionable: '回顾一下是什么帮助了你',
    })
  }

  // 基于连续记录
  if (context.streakDays >= 7 && context.consistency === 'high') {
    suggestions.push({
      type: 'mindset',
      priority: 'low',
      title: '记录习惯很棒',
      description: `已连续记录${context.streakDays}天，自我觉察力在提升`,
      actionable: '继续保持记录习惯',
    })
  }

  // 基于模式
  context.patterns.forEach(pattern => {
    if (pattern.type === 'weekday') {
      suggestions.push({
        type: 'activity',
        priority: 'medium',
        title: '优化每周安排',
        description: pattern.insight,
        actionable: '在心情较低的日子安排喜欢的活动',
      })
    }
    if (pattern.type === 'sequence' && pattern.description.includes('连续')) {
      suggestions.push({
        type: 'social',
        priority: 'high',
        title: '寻求支持',
        description: '持续低落时，与他人交流很重要',
        actionable: '与朋友聊天，或进行户外活动',
      })
    }
  })

  // 基于风险
  if (context.riskLevel === 'high') {
    suggestions.push({
      type: 'professional',
      priority: 'high',
      title: '考虑专业帮助',
      description: '如果持续感到困扰，寻求专业帮助是明智的选择',
      actionable: '可以与心理咨询师聊聊',
    })
  }

  // 去重并排序
  const uniqueSuggestions = suggestions.filter((s, idx, arr) =>
    arr.findIndex(x => x.title === s.title) === idx
  )

  return uniqueSuggestions
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
    .slice(0, 5)
}

function getOverallStatus(score: number, risk: string): 'excellent' | 'good' | 'normal' | 'concerning' | 'warning' {
  if (risk === 'high') return 'warning'
  if (risk === 'medium') return 'concerning'

  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'normal'
  return 'concerning'
}

function getTrendDescription(trend: string, score: number): string {
  const descriptions: Record<string, string> = {
    improving: '心情在逐渐好转，继续保持',
    stable: '心情比较稳定',
    declining: '心情有所下降，注意调节',
    fluctuating: '心情波动较大，建议关注触发因素',
  }
  return descriptions[trend] || '心情状态正常'
}

/**
 * 生成智能体可用的心情分析提示
 */
export function generateMoodContextForAgent(moods: MoodRecord[]): string {
  if (moods.length === 0) {
    return '用户还没有记录过心情。'
  }

  const analysis = analyzeMoods(moods)

  const parts: string[] = []

  // 整体状态
  parts.push(`用户心理状态分析：`)
  parts.push(`- 整体评分：${analysis.overallScore}/100（${getStatusLabel(analysis.overallStatus)}）`)
  parts.push(`- 趋势：${analysis.trendDescription}`)
  parts.push(`- 最常见心情：${analysis.dominantMood}`)
  parts.push(`- 连续记录：${analysis.streakDays}天`)

  // 风险提示
  if (analysis.riskLevel !== 'none' && analysis.riskFactors.length > 0) {
    parts.push(`- ⚠️ 风险因素：${analysis.riskFactors.join('、')}`)
  }

  // 模式
  if (analysis.patterns.length > 0) {
    parts.push(`- 发现模式：${analysis.patterns.map(p => p.description).join('；')}`)
  }

  // 建议
  if (analysis.suggestions.length > 0) {
    const topSuggestion = analysis.suggestions[0]
    parts.push(`- 建议：${topSuggestion.title} - ${topSuggestion.actionable}`)
  }

  return parts.join('\n')
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    excellent: '状态极佳',
    good: '状态良好',
    normal: '状态正常',
    concerning: '需要关注',
    warning: '需要重视',
  }
  return labels[status] || status
}
