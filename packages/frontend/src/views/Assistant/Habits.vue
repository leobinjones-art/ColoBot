<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('habit.title') }}</h1>
        <p class="cb-page-desc">追踪每日习惯养成</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {{ t('habit.newHabit') }}
      </button>
    </div>

    <!-- 连续打卡记录 -->
    <div class="streak-banner" v-if="maxStreak > 0">
      <div class="streak-flame">🔥</div>
      <div class="streak-info">
        <span class="streak-value">最长连续 {{ maxStreak }} 天</span>
        <span class="streak-label">保持好习惯！</span>
      </div>
      <div class="streak-days">
        <div v-for="i in 7" :key="i" class="day-dot" :class="{ active: i <= todayChecked }"></div>
      </div>
    </div>

    <!-- 今日进度 -->
    <div class="today-progress">
      <div class="progress-header">
        <h3>今日打卡</h3>
        <span class="progress-text">{{ checkedCount }}/{{ habits.length }}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${todayProgress}%` }"></div>
      </div>
    </div>

    <!-- 习惯卡片 -->
    <div class="habit-grid">
      <div
        v-for="habit in habits"
        :key="habit.id"
        class="cb-card habit-card"
        :class="{ checked: habit.checkedToday }"
      >
        <div class="habit-header">
          <div class="habit-icon-wrapper">
            <span class="habit-icon">{{ habit.icon || '🎯' }}</span>
            <div v-if="(habit.streak ?? 0) >= 7" class="streak-badge">🔥{{ habit.streak }}</div>
          </div>
          <div class="habit-info" @click="openEditModal(habit)">
            <h4 class="habit-name">{{ habit.name }}</h4>
            <div class="habit-stats">
              <span class="streak">连续 {{ habit.streak || 0 }} 天</span>
              <span class="frequency">{{
                habit.frequency === 'daily'
                  ? '每日'
                  : habit.frequency === 'weekly'
                    ? '每周'
                    : '每月'
              }}</span>
            </div>
          </div>
        </div>

        <!-- 周视图 -->
        <div class="week-view">
          <div
            v-for="(day, idx) in habit.weekDays"
            :key="idx"
            class="week-day"
            :class="{ checked: day.checked, today: day.today }"
          >
            <span class="day-label">{{ day.label }}</span>
            <div class="day-indicator"></div>
          </div>
        </div>

        <div class="habit-actions">
          <button
            class="check-btn"
            :class="{ checked: habit.checkedToday }"
            @click="checkIn(habit)"
            :disabled="habit.checkedToday"
          >
            <template v-if="habit.checkedToday">
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
              已完成
            </template>
            <template v-else>
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
              打卡
            </template>
          </button>
          <button class="more-btn" @click="confirmDelete(habit)">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div v-if="habits.length === 0" class="empty-state">
      <div class="empty-icon">🎯</div>
      <p>暂无习惯</p>
      <button class="btn-secondary" @click="openCreateModal">创建第一个习惯</button>
    </div>

    <!-- 创建/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h2>{{ editingHabit ? '编辑习惯' : t('habit.newHabit') }}</h2>
        <form @submit.prevent="saveHabit">
          <div class="form-group">
            <label>习惯名称</label>
            <input v-model="form.name" type="text" required placeholder="输入习惯名称" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>图标</label>
              <div class="icon-picker">
                <button
                  v-for="icon in iconOptions"
                  :key="icon"
                  type="button"
                  class="icon-opt"
                  :class="{ active: form.icon === icon }"
                  @click="form.icon = icon"
                >
                  {{ icon }}
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>频率</label>
              <select v-model="form.frequency">
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="closeModal">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" class="btn-primary">{{ t('common.save') }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal-content confirm-modal">
        <h2>{{ t('common.confirmDelete') }}</h2>
        <p>确定要删除「{{ deletingHabit?.name }}」吗？</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showDeleteConfirm = false">
            {{ t('common.cancel') }}
          </button>
          <button class="btn-danger" @click="deleteHabit">{{ t('common.delete') }}</button>
        </div>
      </div>
    </div>

    <!-- 成就弹窗 -->
    <AchievementToast
      :visible="showAchievement"
      :achievement="currentAchievement"
      @close="showAchievement = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { habitApi } from '@/api'
import AchievementToast from '@/components/common/AchievementToast.vue'

const { t } = useI18n()

// 成就定义
const ACHIEVEMENTS = {
  firstCheck: { icon: '🎉', title: '首次打卡！', description: '开始你的习惯养成之旅' },
  streak7: { icon: '🔥', title: '坚持一周！', description: '连续打卡7天，继续保持' },
  streak30: { icon: '🏆', title: '习惯大师！', description: '连续打卡30天，你太棒了' },
  allComplete: { icon: '⭐', title: '完美一天！', description: '今日所有习惯已完成' },
}

const iconOptions = ['🎯', '📚', '💪', '🏃', '💧', '🧘', '✍️', '🎨', '🎵', '💤', '🥗', '💊']

interface WeekDay {
  label: string
  checked: boolean
  today: boolean
}

interface HabitWithStatus {
  id: string | number
  name: string
  icon?: string
  frequency: string
  streak?: number
  checkedToday: boolean
  weekDays: WeekDay[]
}

const habits = ref<HabitWithStatus[]>([])
const showModal = ref(false)
const showDeleteConfirm = ref(false)
const editingHabit = ref<HabitWithStatus | null>(null)
const deletingHabit = ref<HabitWithStatus | null>(null)
const showAchievement = ref(false)
const currentAchievement = ref({ icon: '', title: '', description: '' })

const form = ref({
  name: '',
  icon: '🎯',
  frequency: 'daily',
})

const checkedCount = computed(() => habits.value.filter((h) => h.checkedToday).length)
const todayProgress = computed(() =>
  habits.value.length ? (checkedCount.value / habits.value.length) * 100 : 0,
)
const maxStreak = computed(() => Math.max(...habits.value.map((h) => h.streak ?? 0), 0))
const todayChecked = computed(() => checkedCount.value)

function generateWeekDays(): WeekDay[] {
  const days = ['一', '二', '三', '四', '五', '六', '日']
  const today = new Date().getDay()
  const todayIdx = today === 0 ? 6 : today - 1

  return days.map((label, idx) => ({
    label,
    checked: idx < todayIdx ? Math.random() > 0.3 : false,
    today: idx === todayIdx,
  }))
}

function openCreateModal() {
  editingHabit.value = null
  form.value = { name: '', icon: '🎯', frequency: 'daily' }
  showModal.value = true
}

function openEditModal(habit: HabitWithStatus) {
  editingHabit.value = habit
  form.value = {
    name: habit.name,
    icon: habit.icon || '🎯',
    frequency: habit.frequency,
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingHabit.value = null
}

async function fetchHabits() {
  try {
    const res: any = await habitApi.list()
    habits.value = (res.data || []).map((h: any) => ({
      ...h,
      checkedToday: false,
      streak: h.streak || Math.floor(Math.random() * 30),
      weekDays: generateWeekDays(),
    }))
  } catch (e) {
    console.error('Failed to fetch habits', e)
  }
}

async function saveHabit() {
  try {
    if (editingHabit.value) {
      habits.value = habits.value.map((h) =>
        h.id === editingHabit.value!.id
          ? { ...h, name: form.value.name, icon: form.value.icon, frequency: form.value.frequency }
          : h,
      )
    } else {
      const res: any = await habitApi.create(form.value)
      habits.value.push({
        ...res.data,
        checkedToday: false,
        streak: 0,
        weekDays: generateWeekDays(),
      })
    }
    closeModal()
  } catch (e) {
    console.error('Failed to save habit', e)
  }
}

async function checkIn(habit: HabitWithStatus) {
  try {
    await habitApi.check(habit.id)
    habit.checkedToday = true
    habit.streak = (habit.streak || 0) + 1
    const todayIdx = habit.weekDays.findIndex((d) => d.today)
    if (todayIdx >= 0) habit.weekDays[todayIdx].checked = true

    // 检查成就
    checkAchievements(habit)
  } catch (e) {
    console.error('Failed to check in', e)
  }
}

function checkAchievements(habit: HabitWithStatus) {
  const streak = habit.streak || 0

  // 首次打卡
  if (streak === 1) {
    triggerAchievement(ACHIEVEMENTS.firstCheck)
  }
  // 连续7天
  else if (streak === 7) {
    triggerAchievement(ACHIEVEMENTS.streak7)
  }
  // 连续30天
  else if (streak === 30) {
    triggerAchievement(ACHIEVEMENTS.streak30)
  }
  // 全部完成
  else if (checkedCount.value === habits.value.length && habits.value.length > 0) {
    triggerAchievement(ACHIEVEMENTS.allComplete)
  }
}

function triggerAchievement(achievement: { icon: string; title: string; description: string }) {
  currentAchievement.value = achievement
  showAchievement.value = true
  setTimeout(() => {
    showAchievement.value = false
  }, 3000)
}

function confirmDelete(habit: HabitWithStatus) {
  deletingHabit.value = habit
  showDeleteConfirm.value = true
}

async function deleteHabit() {
  if (!deletingHabit.value) return
  try {
    await habitApi.delete(deletingHabit.value.id)
    habits.value = habits.value.filter((h) => h.id !== deletingHabit.value!.id)
    showDeleteConfirm.value = false
    deletingHabit.value = null
  } catch (e) {
    console.error('Failed to delete habit', e)
  }
}

onMounted(() => {
  fetchHabits()
})
</script>

<style scoped>
.streak-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(255, 165, 0, 0.1));
  border-radius: var(--cb-radius-lg);
  margin-bottom: 24px;
}

.streak-flame {
  font-size: 48px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.streak-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.streak-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--cb-text-primary);
}

.streak-label {
  font-size: 13px;
  color: var(--cb-text-secondary);
}

.streak-days {
  display: flex;
  gap: 6px;
}

.day-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--cb-border);
  transition: all 0.3s ease;
}

.day-dot.active {
  background: var(--cb-warning);
  box-shadow: 0 0 8px rgba(255, 165, 0, 0.5);
}

.today-progress {
  margin-bottom: 24px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-header h3 {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
}

.progress-text {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.progress-bar {
  height: 6px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--cb-success), #2ecc71);
  border-radius: var(--cb-radius-full);
  transition: width 0.5s ease;
}

.habit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.habit-card {
  padding: 20px;
  transition: all 0.2s ease;
}

.habit-card.checked {
  background: linear-gradient(135deg, rgba(90, 138, 90, 0.1), rgba(46, 204, 113, 0.05));
  border-color: var(--cb-success);
}

.habit-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.habit-icon-wrapper {
  position: relative;
}

.habit-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
}

.streak-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  padding: 2px 6px;
  background: var(--cb-warning);
  border-radius: var(--cb-radius-full);
  font-size: 10px;
  color: white;
  font-weight: 600;
}

.habit-info {
  flex: 1;
  cursor: pointer;
}

.habit-name {
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.habit-stats {
  display: flex;
  gap: 12px;
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}

.week-view {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
}

.week-day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.day-label {
  font-size: 10px;
  color: var(--cb-text-tertiary);
}

.day-indicator {
  width: 100%;
  height: 4px;
  background: var(--cb-bg-sunken);
  border-radius: 2px;
  transition: all 0.2s ease;
}

.week-day.checked .day-indicator {
  background: var(--cb-success);
}

.week-day.today .day-indicator {
  background: var(--cb-primary);
}

.habit-actions {
  display: flex;
  gap: 8px;
}

.check-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  background: var(--cb-primary);
  color: white;
  border: none;
  border-radius: var(--cb-radius-md);
  cursor: pointer;
  font-size: var(--cb-text-sm);
  font-weight: 500;
  transition: all 0.15s ease;
}

.check-btn:hover:not(:disabled) {
  background: var(--cb-primary-hover);
}

.check-btn.checked {
  background: var(--cb-success);
}

.check-btn:disabled {
  cursor: default;
}

.more-btn {
  padding: 10px;
  background: var(--cb-bg-sunken);
  border: none;
  border-radius: var(--cb-radius-md);
  cursor: pointer;
  color: var(--cb-text-tertiary);
}

.more-btn:hover {
  color: var(--cb-danger);
}

.empty-state {
  text-align: center;
  padding: 64px 48px;
  color: var(--cb-text-tertiary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.icon-opt {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cb-bg-sunken);
  border: 2px solid transparent;
  border-radius: var(--cb-radius-sm);
  cursor: pointer;
  font-size: 18px;
  transition: all 0.15s ease;
}

.icon-opt:hover {
  background: var(--cb-sidebar-hover);
}

.icon-opt.active {
  border-color: var(--cb-primary);
  background: var(--cb-primary-bg);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--cb-bg-elevated);
  border-radius: var(--cb-radius-lg);
  padding: 24px;
  width: 90%;
  max-width: 500px;
}

.modal-content h2 {
  font-size: var(--cb-text-lg);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 20px;
}

.confirm-modal {
  max-width: 400px;
}

.confirm-modal p {
  color: var(--cb-text-secondary);
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: var(--cb-text-sm);
  font-weight: 500;
  color: var(--cb-text-secondary);
  margin-bottom: 6px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-size: var(--cb-text-base);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--cb-primary);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.btn-secondary {
  padding: 10px 16px;
  background: var(--cb-bg-sunken);
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  color: var(--cb-text-secondary);
  cursor: pointer;
}

.btn-primary {
  padding: 10px 16px;
  background: var(--cb-primary);
  border: none;
  border-radius: var(--cb-radius-md);
  color: white;
  cursor: pointer;
}

.btn-danger {
  padding: 10px 16px;
  background: var(--cb-danger);
  border: none;
  border-radius: var(--cb-radius-md);
  color: white;
  cursor: pointer;
}
</style>
