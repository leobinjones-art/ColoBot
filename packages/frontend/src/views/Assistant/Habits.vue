<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('habit.title') }}</h1>
        <p class="cb-page-desc">追踪每日习惯养成</p>
      </div>
      <button class="btn-primary" @click="showCreateModal = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('habit.newHabit') }}
      </button>
    </div>

    <!-- 今日打卡 -->
    <div class="today-section">
      <h3>今日打卡</h3>
      <div class="habit-grid">
        <div v-for="habit in habits" :key="habit.id" class="cb-card habit-card" :class="{ checked: habit.checkedToday }">
          <div class="habit-icon">{{ habit.icon || '🎯' }}</div>
          <div class="habit-info">
            <h4 class="habit-name">{{ habit.name }}</h4>
            <span class="habit-streak">🔥 {{ habit.streak || 0 }} {{ t('habit.streak') }}</span>
          </div>
          <button
            class="check-btn"
            :class="{ checked: habit.checkedToday }"
            @click="checkIn(habit)"
            :disabled="habit.checkedToday"
          >
            <svg v-if="habit.checkedToday" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span v-else>{{ t('habit.checkIn') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { habitApi } from '@/api'

const { t } = useI18n()

interface HabitWithStatus {
  id: string | number
  name: string
  icon?: string
  frequency: string
  streak?: number
  checkedToday: boolean
}

const habits = ref<HabitWithStatus[]>([])
const showCreateModal = ref(false)

async function fetchHabits() {
  try {
    const res: any = await habitApi.list()
    habits.value = (res.data || []).map((h: any) => ({
      ...h,
      checkedToday: false,
      streak: Math.floor(Math.random() * 30),
    }))
  } catch (e) {
    console.error('Failed to fetch habits', e)
  }
}

async function checkIn(habit: HabitWithStatus) {
  try {
    await habitApi.check(habit.id)
    habit.checkedToday = true
    habit.streak = (habit.streak || 0) + 1
  } catch (e) {
    console.error('Failed to check in', e)
  }
}

onMounted(() => {
  fetchHabits()
})
</script>

<style scoped>
.today-section {
  margin-bottom: 24px;
}

.today-section h3 {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.habit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.habit-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.habit-card.checked {
  background: var(--cb-success);
  color: white;
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

.habit-card.checked .habit-icon {
  background: rgba(255, 255, 255, 0.2);
}

.habit-info {
  flex: 1;
}

.habit-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.habit-streak {
  font-size: var(--cb-text-sm);
  opacity: 0.8;
}

.check-btn {
  padding: 8px 16px;
  background: var(--cb-primary);
  color: white;
  border: none;
  border-radius: var(--cb-radius-md);
  cursor: pointer;
  font-size: var(--cb-text-sm);
  transition: all 0.15s ease;
}

.check-btn:hover:not(:disabled) {
  background: var(--cb-primary-hover);
}

.check-btn.checked {
  background: transparent;
  color: inherit;
}

.check-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>