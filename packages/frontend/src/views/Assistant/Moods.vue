<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('mood.title') }}</h1>
        <p class="cb-page-desc">记录每日心情变化</p>
      </div>
    </div>

    <!-- 心情日历热力图 -->
    <div class="mood-calendar cb-card">
      <div class="calendar-header">
        <button class="nav-btn" @click="prevMonth">‹</button>
        <span class="month-label">{{ currentMonthLabel }}</span>
        <button class="nav-btn" @click="nextMonth">›</button>
      </div>
      <div class="calendar-grid">
        <div class="weekday-labels">
          <span v-for="day in ['一', '二', '三', '四', '五', '六', '日']" :key="day">{{
            day
          }}</span>
        </div>
        <div class="calendar-days">
          <div
            v-for="(cell, idx) in calendarCells"
            :key="idx"
            class="calendar-cell"
            :class="{ empty: !cell.day, today: cell.isToday, hasMood: cell.mood }"
            :style="cell.mood ? { backgroundColor: getMoodColor(cell.mood, cell.score) } : {}"
            @click="cell.day && selectDate(cell)"
          >
            <span v-if="cell.day" class="day-num">{{ cell.day }}</span>
            <span v-if="cell.mood" class="mood-emoji-sm">{{ getMoodEmoji(cell.mood) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 心情统计 -->
    <div class="mood-stats">
      <div class="stat-card cb-card">
        <div class="stat-icon">📊</div>
        <div class="stat-info">
          <span class="stat-value">{{ averageScore.toFixed(1) }}</span>
          <span class="stat-label">平均心情分</span>
        </div>
      </div>
      <div class="stat-card cb-card">
        <div class="stat-icon">🔥</div>
        <div class="stat-info">
          <span class="stat-value">{{ streakDays }}</span>
          <span class="stat-label">连续记录天</span>
        </div>
      </div>
      <div class="stat-card cb-card">
        <div class="stat-icon">{{ mostFrequentEmoji }}</div>
        <div class="stat-info">
          <span class="stat-value">{{ mostFrequentMood }}</span>
          <span class="stat-label">最常见心情</span>
        </div>
      </div>
    </div>

    <!-- 智能提示 -->
    <div v-if="smartHint" class="smart-hint cb-card">
      <span class="hint-icon">{{ smartHint.icon }}</span>
      <span class="hint-text">{{ smartHint.text }}</span>
    </div>

    <!-- 心理分析面板 -->
    <div v-if="moodAnalysis && moods.length >= 3" class="mood-analysis cb-card">
      <h3>🧠 心理状态分析</h3>

      <div class="analysis-overview">
        <div class="analysis-score">
          <div class="score-ring" :class="moodAnalysis.overallStatus">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" class="bg-ring" />
              <circle
                cx="50"
                cy="50"
                r="45"
                class="progress-ring"
                :stroke-dasharray="`${moodAnalysis.overallScore * 2.83} 283`"
              />
            </svg>
            <div class="score-center">
              <span class="score-num">{{ moodAnalysis.overallScore }}</span>
              <span class="score-label">{{ getStatusLabel(moodAnalysis.overallStatus) }}</span>
            </div>
          </div>
        </div>

        <div class="analysis-details">
          <div class="detail-item">
            <span class="detail-label">趋势</span>
            <span class="detail-value" :class="moodAnalysis.trend">
              {{ getTrendIcon(moodAnalysis.trend) }} {{ moodAnalysis.trendDescription }}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">主导情绪</span>
            <span class="detail-value">{{ moodAnalysis.dominantMood }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">记录连续性</span>
            <span class="detail-value"
              >{{ moodAnalysis.streakDays }}天 ({{ consistencyLabel }})</span
            >
          </div>
        </div>
      </div>

      <!-- 风险提示 -->
      <div
        v-if="moodAnalysis.riskLevel !== 'none'"
        class="risk-alert"
        :class="moodAnalysis.riskLevel"
      >
        <span class="risk-icon">{{
          moodAnalysis.riskLevel === 'high'
            ? '🚨'
            : moodAnalysis.riskLevel === 'medium'
              ? '⚠️'
              : '💡'
        }}</span>
        <div class="risk-content">
          <span class="risk-title">{{
            moodAnalysis.riskLevel === 'high'
              ? '需要重视'
              : moodAnalysis.riskLevel === 'medium'
                ? '需要关注'
                : '小提示'
          }}</span>
          <span class="risk-factors">{{ moodAnalysis.riskFactors.join('、') }}</span>
        </div>
      </div>

      <!-- 发现的模式 -->
      <div v-if="moodAnalysis.patterns.length > 0" class="patterns-section">
        <h4>📊 发现的模式</h4>
        <div class="pattern-list">
          <div v-for="(pattern, idx) in moodAnalysis.patterns" :key="idx" class="pattern-item">
            <span class="pattern-desc">{{ pattern.description }}</span>
            <span class="pattern-insight">{{ pattern.insight }}</span>
          </div>
        </div>
      </div>

      <!-- 建议 -->
      <div v-if="moodAnalysis.suggestions.length > 0" class="suggestions-section">
        <h4>💡 个性化建议</h4>
        <div class="suggestion-list">
          <div
            v-for="(suggestion, idx) in moodAnalysis.suggestions"
            :key="idx"
            class="suggestion-item"
            :class="suggestion.priority"
          >
            <span class="suggestion-title">{{ suggestion.title }}</span>
            <span class="suggestion-desc">{{ suggestion.description }}</span>
            <span class="suggestion-action">👉 {{ suggestion.actionable }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 心情选择器 -->
    <div class="mood-selector cb-card">
      <h3>{{ selectedDate ? `${formatDate(selectedDate)} 心情如何？` : '今天心情如何？' }}</h3>
      <div class="mood-options">
        <button
          v-for="mood in moodOptions"
          :key="mood.value"
          class="mood-btn"
          :class="{ active: selectedMood === mood.value }"
          @click="selectMood(mood.value)"
        >
          <span class="mood-emoji">{{ mood.emoji }}</span>
          <span class="mood-label">{{ t(`mood.${mood.value}`) }}</span>
          <div v-if="selectedMood === mood.value" class="mood-glow"></div>
        </button>
      </div>
      <Transition name="slide">
        <div v-if="selectedMood" class="mood-details">
          <div class="score-section">
            <label>程度</label>
            <div class="score-slider">
              <input type="range" v-model="score" min="1" max="10" />
              <div class="score-marks"><span>1</span><span>5</span><span>10</span></div>
            </div>
            <div class="score-display">
              <span class="score-value" :class="scoreClass">{{ score }}</span>
              <span class="score-hint">{{ scoreHint }}</span>
            </div>
          </div>
          <textarea v-model="note" placeholder="记录一下今天的心情..." rows="3"></textarea>
          <button class="btn-primary save-btn" @click="saveMood">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            保存记录
          </button>
        </div>
      </Transition>
    </div>

    <!-- 心情趋势 -->
    <div class="mood-trends cb-card" v-if="moods.length > 0">
      <h3>心情趋势</h3>
      <div class="trend-chart">
        <div
          v-for="(mood, idx) in recentMoods"
          :key="idx"
          class="trend-bar"
          :style="{ height: `${mood.score * 10}%` }"
        >
          <div
            class="bar-fill"
            :style="{ backgroundColor: getMoodColor(mood.mood, mood.score) }"
          ></div>
          <span class="bar-emoji">{{ getMoodEmoji(mood.mood) }}</span>
        </div>
      </div>
      <div class="trend-labels">
        <span v-for="(mood, idx) in recentMoods" :key="idx">{{ formatDay(mood.loggedAt) }}</span>
      </div>
    </div>

    <!-- 心情历史 -->
    <div class="mood-history">
      <h3>最近记录</h3>
      <div class="mood-list">
        <TransitionGroup name="mood-item">
          <div v-for="mood in moods" :key="mood.id" class="mood-item cb-card">
            <div class="mood-visual" :style="{ background: getMoodGradient(mood.mood) }">
              <span class="mood-emoji-lg">{{ getMoodEmoji(mood.mood) }}</span>
              <span class="mood-score">{{ mood.score }}</span>
            </div>
            <div class="mood-info">
              <div class="mood-name">{{ t(`mood.${mood.mood}`) }}</div>
              <div class="mood-note" v-if="mood.note">{{ mood.note }}</div>
              <div class="mood-date">{{ formatDate(mood.loggedAt) }}</div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { moodApi } from '@/api'
import type { Mood } from '@/types'
import {
  analyzeMoods,
  generateMoodContextForAgent,
  type MoodAnalysis,
} from '@/services/moodAnalyzer'

const { t } = useI18n()

const moodOptions = [
  { value: 'happy', emoji: '😊' },
  { value: 'neutral', emoji: '😐' },
  { value: 'sad', emoji: '😢' },
  { value: 'angry', emoji: '😠' },
  { value: 'anxious', emoji: '😰' },
]

const moodColors: Record<string, string> = {
  happy: '#2ecc71',
  neutral: '#f1c40f',
  sad: '#3498db',
  angry: '#e74c3c',
  anxious: '#9b59b6',
}

const selectedMood = ref<string | null>(null)
const score = ref(5)
const note = ref('')
const moods = ref<Mood[]>([])
const selectedDate = ref<Date | null>(null)
const currentMonth = ref(new Date())
const moodAnalysis = ref<MoodAnalysis | null>(null)

const scoreClass = computed(() => {
  if (score.value >= 8) return 'great'
  if (score.value >= 6) return 'good'
  if (score.value >= 4) return 'okay'
  return 'low'
})

const scoreHint = computed(() => {
  if (score.value >= 8) return '非常棒！'
  if (score.value >= 6) return '还不错'
  if (score.value >= 4) return '一般般'
  return '需要关注'
})

const recentMoods = computed(() => moods.value.slice(0, 7))

const averageScore = computed(() => {
  if (moods.value.length === 0) return 0
  const sum = moods.value.reduce((acc, m) => acc + m.score, 0)
  return sum / moods.value.length
})

const streakDays = computed(() => {
  if (moods.value.length === 0) return 0
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)
    const hasMood = moods.value.some((m) => {
      const mDate = new Date(m.loggedAt)
      mDate.setHours(0, 0, 0, 0)
      return mDate.getTime() === checkDate.getTime()
    })
    if (hasMood) streak++
    else break
  }
  return streak
})

const mostFrequentMood = computed(() => {
  if (moods.value.length === 0) return '-'
  const counts: Record<string, number> = {}
  moods.value.forEach((m) => {
    counts[m.mood] = (counts[m.mood] || 0) + 1
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0] ? t(`mood.${sorted[0][0]}`) : '-'
})

const mostFrequentEmoji = computed(() => {
  if (moods.value.length === 0) return '😐'
  const counts: Record<string, number> = {}
  moods.value.forEach((m) => {
    counts[m.mood] = (counts[m.mood] || 0) + 1
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0] ? getMoodEmoji(sorted[0][0]) : '😐'
})

const smartHint = computed(() => {
  if (moods.value.length < 3) return null

  const recent = moods.value.slice(0, 5)
  const avgRecent = recent.reduce((acc, m) => acc + m.score, 0) / recent.length

  if (avgRecent >= 7) {
    return { icon: '🌟', text: '最近心情不错，继续保持！' }
  } else if (avgRecent <= 4) {
    return { icon: '💪', text: '最近心情有些低落，试试运动或与朋友聊天？' }
  } else if (streakDays.value >= 7) {
    return { icon: '🏆', text: `已连续记录${streakDays.value}天，太棒了！` }
  }
  return null
})

const currentMonthLabel = computed(() => {
  return currentMonth.value.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
})

const calendarCells = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
  const today = new Date()

  const cells: any[] = []

  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: null })
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d)
    const moodEntry = moods.value.find((m) => {
      const mDate = new Date(m.loggedAt)
      return mDate.toDateString() === date.toDateString()
    })
    cells.push({
      day: d,
      date,
      isToday: date.toDateString() === today.toDateString(),
      mood: moodEntry?.mood,
      score: moodEntry?.score,
    })
  }

  return cells
})

function getMoodEmoji(mood: string): string {
  return moodOptions.find((m) => m.value === mood)?.emoji || '😐'
}

function getMoodColor(mood: string, score: number = 5): string {
  const base = moodColors[mood] || '#95a5a6'
  const opacity = 0.3 + (score / 10) * 0.7
  const hex = base.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

function getMoodGradient(mood: string): string {
  const color = moodColors[mood] || '#95a5a6'
  return `linear-gradient(135deg, ${color}22, ${color}44)`
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function formatDay(date: string): string {
  return new Date(date).toLocaleDateString('zh-CN', { weekday: 'short' })
}

function prevMonth() {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() - 1,
    1,
  )
}

function nextMonth() {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() + 1,
    1,
  )
}

function selectDate(cell: any) {
  selectedDate.value = cell.date
}

function selectMood(mood: string) {
  selectedMood.value = mood
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

function getTrendIcon(trend: string): string {
  const icons: Record<string, string> = {
    improving: '📈',
    stable: '➡️',
    declining: '📉',
    fluctuating: '↕️',
  }
  return icons[trend] || '➡️'
}

const consistencyLabel = computed(() => {
  if (!moodAnalysis.value) return ''
  const labels: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
  }
  return labels[moodAnalysis.value.consistency] || ''
})

async function saveMood() {
  if (!selectedMood.value) return

  try {
    await moodApi.create({
      mood: selectedMood.value,
      score: score.value,
      note: note.value,
    })
    selectedMood.value = null
    score.value = 5
    note.value = ''
    selectedDate.value = null
    fetchMoods()
  } catch (e) {
    console.error('Failed to save mood', e)
  }
}

async function fetchMoods() {
  try {
    const res: any = await moodApi.list({ limit: 30 })
    moods.value = res.data || []
    // 分析心情数据
    moodAnalysis.value = analyzeMoods(
      moods.value.map((m) => ({
        mood: m.mood,
        score: m.score,
        note: m.note,
        loggedAt: m.loggedAt,
      })),
    )
  } catch (e) {
    console.error('Failed to fetch moods', e)
  }
}

onMounted(() => {
  fetchMoods()
})
</script>

<style scoped>
.mood-calendar {
  padding: 20px;
  margin-bottom: 24px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}

.nav-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cb-bg-sunken);
  border: none;
  border-radius: var(--cb-radius-sm);
  cursor: pointer;
  font-size: 18px;
  color: var(--cb-text-secondary);
}

.nav-btn:hover {
  background: var(--cb-sidebar-hover);
}

.month-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--cb-text-primary);
}

.weekday-labels {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.weekday-labels span {
  text-align: center;
  font-size: 12px;
  color: var(--cb-text-tertiary);
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: var(--cb-radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.calendar-cell:not(.empty):hover {
  background: var(--cb-bg-sunken);
}

.calendar-cell.today {
  border: 2px solid var(--cb-primary);
}

.calendar-cell.hasMood {
  background: var(--cb-bg-sunken);
}

.day-num {
  font-size: 12px;
  color: var(--cb-text-secondary);
}

.mood-emoji-sm {
  font-size: 14px;
}

.mood-selector {
  margin-bottom: 24px;
  padding: 24px;
}

.mood-selector h3 {
  font-size: var(--cb-text-lg);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 20px;
  text-align: center;
}

.mood-options {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 20px;
}

.mood-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: var(--cb-bg-sunken);
  border: 2px solid transparent;
  border-radius: var(--cb-radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.mood-btn:hover {
  background: var(--cb-sidebar-hover);
  transform: translateY(-2px);
}

.mood-btn.active {
  border-color: var(--cb-primary);
  background: var(--cb-primary-bg);
}

.mood-emoji {
  font-size: 40px;
  transition: transform 0.2s ease;
}

.mood-btn:hover .mood-emoji {
  transform: scale(1.1);
}

.mood-label {
  font-size: 12px;
  color: var(--cb-text-secondary);
}

.mood-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, var(--cb-primary) 0%, transparent 70%);
  opacity: 0.1;
  animation: glow 2s ease-in-out infinite;
}

@keyframes glow {
  0%,
  100% {
    opacity: 0.1;
  }
  50% {
    opacity: 0.2;
  }
}

.mood-details {
  padding-top: 20px;
  border-top: 1px solid var(--cb-border);
}

.score-section {
  margin-bottom: 20px;
}

.score-section label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--cb-text-secondary);
  margin-bottom: 8px;
}

.score-slider {
  margin-bottom: 8px;
}

.score-slider input {
  width: 100%;
  accent-color: var(--cb-primary);
}

.score-marks {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--cb-text-tertiary);
}

.score-display {
  display: flex;
  align-items: center;
  gap: 12px;
}

.score-value {
  font-size: 32px;
  font-weight: 700;
}

.score-value.great {
  color: var(--cb-success);
}
.score-value.good {
  color: #27ae60;
}
.score-value.okay {
  color: var(--cb-warning);
}
.score-value.low {
  color: var(--cb-danger);
}

.score-hint {
  font-size: 14px;
  color: var(--cb-text-secondary);
}

.mood-details textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  margin-bottom: 16px;
  font-family: inherit;
  resize: none;
}

.save-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.mood-trends {
  padding: 20px;
  margin-bottom: 24px;
}

.mood-trends h3 {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 100px;
  margin-bottom: 8px;
}

.trend-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
}

.bar-fill {
  width: 100%;
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
}

.bar-emoji {
  position: absolute;
  bottom: -20px;
  font-size: 14px;
}

.trend-labels {
  display: flex;
  gap: 8px;
  padding-top: 24px;
}

.trend-labels span {
  flex: 1;
  text-align: center;
  font-size: 11px;
  color: var(--cb-text-tertiary);
}

.mood-history h3 {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.mood-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mood-item {
  display: flex;
  gap: 16px;
  padding: 16px;
}

.mood-visual {
  width: 60px;
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: var(--cb-radius-md);
}

.mood-emoji-lg {
  font-size: 24px;
}

.mood-score {
  font-size: 12px;
  font-weight: 600;
  color: var(--cb-text-primary);
}

.mood-info {
  flex: 1;
}

.mood-name {
  font-weight: 500;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.mood-note {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
  margin-bottom: 4px;
}

.mood-date {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.mood-item-enter-active,
.mood-item-leave-active {
  transition: all 0.3s ease;
}

.mood-item-enter-from,
.mood-item-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.mood-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.stat-icon {
  font-size: 28px;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--cb-text-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--cb-text-tertiary);
}

.smart-hint {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(155, 89, 182, 0.1));
  border-left: 3px solid var(--cb-primary);
}

.hint-icon {
  font-size: 24px;
}

.hint-text {
  font-size: 14px;
  color: var(--cb-text-primary);
}

.mood-analysis {
  padding: 24px;
  margin-bottom: 24px;
}

.mood-analysis h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 20px;
}

.analysis-overview {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
}

.analysis-score {
  flex-shrink: 0;
}

.score-ring {
  position: relative;
  width: 100px;
  height: 100px;
}

.score-ring svg {
  transform: rotate(-90deg);
}

.bg-ring {
  fill: none;
  stroke: var(--cb-border);
  stroke-width: 8;
}

.progress-ring {
  fill: none;
  stroke: var(--cb-success);
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dasharray 0.5s ease;
}

.score-ring.warning .progress-ring {
  stroke: var(--cb-danger);
}
.score-ring.concerning .progress-ring {
  stroke: var(--cb-warning);
}
.score-ring.normal .progress-ring {
  stroke: var(--cb-primary);
}

.score-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.score-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--cb-text-primary);
}

.score-label {
  font-size: 10px;
  color: var(--cb-text-tertiary);
}

.analysis-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 13px;
  color: var(--cb-text-tertiary);
}

.detail-value {
  font-size: 13px;
  color: var(--cb-text-primary);
}

.detail-value.improving {
  color: var(--cb-success);
}
.detail-value.declining {
  color: var(--cb-danger);
}
.detail-value.fluctuating {
  color: var(--cb-warning);
}

.risk-alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: var(--cb-radius-md);
  margin-bottom: 20px;
}

.risk-alert.high {
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid var(--cb-danger);
}

.risk-alert.medium {
  background: rgba(245, 158, 11, 0.1);
  border-left: 3px solid var(--cb-warning);
}

.risk-alert.low {
  background: rgba(59, 130, 246, 0.1);
  border-left: 3px solid var(--cb-info);
}

.risk-icon {
  font-size: 20px;
}

.risk-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.risk-title {
  font-weight: 600;
  color: var(--cb-text-primary);
}

.risk-factors {
  font-size: 13px;
  color: var(--cb-text-secondary);
}

.patterns-section,
.suggestions-section {
  margin-bottom: 20px;
}

.patterns-section h4,
.suggestions-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 12px;
}

.pattern-list,
.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pattern-item {
  padding: 12px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
}

.pattern-desc {
  display: block;
  font-size: 13px;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.pattern-insight {
  display: block;
  font-size: 12px;
  color: var(--cb-text-tertiary);
}

.suggestion-item {
  padding: 12px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
  border-left: 3px solid var(--cb-border);
}

.suggestion-item.high {
  border-left-color: var(--cb-danger);
}

.suggestion-item.medium {
  border-left-color: var(--cb-warning);
}

.suggestion-item.low {
  border-left-color: var(--cb-success);
}

.suggestion-title {
  display: block;
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.suggestion-desc {
  display: block;
  font-size: 13px;
  color: var(--cb-text-secondary);
  margin-bottom: 8px;
}

.suggestion-action {
  display: block;
  font-size: 12px;
  color: var(--cb-primary);
}
</style>
