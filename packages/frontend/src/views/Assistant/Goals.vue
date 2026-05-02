<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('goal.title') }}</h1>
        <p class="cb-page-desc">追踪个人目标进度</p>
      </div>
      <button class="btn-primary" @click="showCreateModal = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('goal.newGoal') }}
      </button>
    </div>

    <!-- 目标列表 -->
    <div class="goal-list">
      <div v-for="goal in goals" :key="goal.id" class="cb-card goal-card">
        <div class="goal-header">
          <h3 class="goal-title">{{ goal.title }}</h3>
          <span class="goal-status" :class="goal.status">{{ goal.status }}</span>
        </div>
        <p v-if="goal.description" class="goal-desc">{{ goal.description }}</p>
        <div class="goal-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${goal.progress}%` }"></div>
          </div>
          <span class="progress-text">{{ goal.progress }}%</span>
        </div>
        <div class="goal-footer">
          <span v-if="goal.targetDate" class="target-date">
            目标日期：{{ formatDate(goal.targetDate) }}
          </span>
          <div class="goal-actions">
            <button class="action-btn" @click="updateProgress(goal, 10)">+10%</button>
            <button class="action-btn" @click="updateProgress(goal, -10)">-10%</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="goals.length === 0" class="empty-state">
      <p>暂无目标，点击上方按钮创建</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { goalApi } from '@/api'
import type { Goal } from '@/types'

const { t } = useI18n()

const goals = ref<Goal[]>([])
const showCreateModal = ref(false)

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString()
}

async function fetchGoals() {
  try {
    const res: any = await goalApi.list()
    goals.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch goals', e)
  }
}

async function updateProgress(goal: Goal, delta: number) {
  const newProgress = Math.max(0, Math.min(100, goal.progress + delta))
  try {
    await goalApi.progress(goal.id, newProgress)
    goal.progress = newProgress
    if (newProgress >= 100) {
      goal.status = 'completed'
    }
  } catch (e) {
    console.error('Failed to update progress', e)
  }
}

onMounted(() => {
  fetchGoals()
})
</script>

<style scoped>
.goal-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.goal-card {
  padding: 20px;
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.goal-title {
  font-size: var(--cb-text-lg);
  font-weight: 600;
  color: var(--cb-text-primary);
}

.goal-status {
  padding: 4px 8px;
  border-radius: var(--cb-radius-sm);
  font-size: var(--cb-text-xs);
  text-transform: uppercase;
}

.goal-status.active {
  background: var(--cb-info);
  color: white;
}

.goal-status.completed {
  background: var(--cb-success);
  color: white;
}

.goal-desc {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
  margin-bottom: 16px;
}

.goal-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--cb-primary);
  transition: width 0.3s ease;
}

.progress-text {
  font-weight: 600;
  color: var(--cb-primary);
  min-width: 40px;
}

.goal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.target-date {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-tertiary);
}

.goal-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  background: var(--cb-bg-sunken);
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-sm);
  cursor: pointer;
  font-size: var(--cb-text-sm);
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--cb-sidebar-hover);
}

.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--cb-text-tertiary);
}
</style>