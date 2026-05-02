<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('goal.title') }}</h1>
        <p class="cb-page-desc">追踪个人目标进度</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('goal.newGoal') }}
      </button>
    </div>

    <!-- 目标概览 -->
    <div class="goals-overview">
      <div class="overview-card total">
        <div class="overview-icon">🎯</div>
        <div class="overview-content">
          <span class="overview-value">{{ goals.length }}</span>
          <span class="overview-label">总目标</span>
        </div>
      </div>
      <div class="overview-card active">
        <div class="overview-icon">🚀</div>
        <div class="overview-content">
          <span class="overview-value">{{ activeGoals }}</span>
          <span class="overview-label">进行中</span>
        </div>
      </div>
      <div class="overview-card completed">
        <div class="overview-icon">✅</div>
        <div class="overview-content">
          <span class="overview-value">{{ completedGoals }}</span>
          <span class="overview-label">已完成</span>
        </div>
      </div>
      <div class="overview-card average">
        <div class="overview-icon">📊</div>
        <div class="overview-content">
          <span class="overview-value">{{ averageProgress }}%</span>
          <span class="overview-label">平均进度</span>
        </div>
      </div>
    </div>

    <!-- 目标列表 -->
    <div class="goal-list">
      <TransitionGroup name="goal-list">
        <div v-for="goal in sortedGoals" :key="goal.id" class="cb-card goal-card" :class="goal.status">
          <!-- 目标头部 -->
          <div class="goal-header">
            <div class="goal-title-row">
              <h3 class="goal-title" @click="openEditModal(goal)">{{ goal.title }}</h3>
              <span class="goal-status" :class="goal.status">
                {{ goal.status === 'active' ? '进行中' : '已完成' }}
              </span>
            </div>
            <p v-if="goal.description" class="goal-desc">{{ goal.description }}</p>
          </div>

          <!-- 进度环 -->
          <div class="goal-progress-section">
            <div class="progress-ring">
              <svg viewBox="0 0 100 100">
                <circle class="ring-bg" cx="50" cy="50" r="40"/>
                <circle class="ring-fill" cx="50" cy="50" r="40"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="getProgressOffset(goal.progress)"
                  :class="getProgressClass(goal.progress)"/>
              </svg>
              <div class="ring-center">
                <span class="progress-value">{{ goal.progress }}</span>
                <span class="progress-unit">%</span>
              </div>
            </div>

            <!-- 里程碑 -->
            <div class="milestones">
              <div class="milestone" :class="{ reached: goal.progress >= 25 }">
                <div class="milestone-dot"></div>
                <span>25%</span>
              </div>
              <div class="milestone" :class="{ reached: goal.progress >= 50 }">
                <div class="milestone-dot"></div>
                <span>50%</span>
              </div>
              <div class="milestone" :class="{ reached: goal.progress >= 75 }">
                <div class="milestone-dot"></div>
                <span>75%</span>
              </div>
              <div class="milestone" :class="{ reached: goal.progress >= 100 }">
                <div class="milestone-dot"></div>
                <span>100%</span>
              </div>
            </div>
          </div>

          <!-- 目标底部 -->
          <div class="goal-footer">
            <div class="goal-meta">
              <span v-if="goal.targetDate" class="target-date" :class="{ urgent: isUrgent(goal) }">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {{ formatDate(goal.targetDate) }}
                <span v-if="isUrgent(goal)" class="urgent-badge">紧迫</span>
              </span>
              <span class="days-left" v-if="goal.targetDate && goal.status === 'active'">
                {{ getDaysLeft(goal.targetDate) }}天剩余
              </span>
            </div>
            <div class="goal-actions">
              <button class="action-btn progress" @click="updateProgress(goal, 10)" :disabled="goal.progress >= 100">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
              <button class="action-btn regress" @click="updateProgress(goal, -10)" :disabled="goal.progress <= 0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
              <button class="action-btn delete" @click="confirmDelete(goal)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- 完成动画 -->
          <div v-if="goal.status === 'completed'" class="completed-overlay">
            <div class="completed-badge">🎉 完成！</div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <div v-if="goals.length === 0" class="empty-state">
      <div class="empty-icon">🎯</div>
      <p>暂无目标</p>
      <button class="btn-secondary" @click="openCreateModal">创建第一个目标</button>
    </div>

    <!-- 创建/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h2>{{ editingGoal ? '编辑目标' : t('goal.newGoal') }}</h2>
        <form @submit.prevent="saveGoal">
          <div class="form-group">
            <label>{{ t('goal.title') }}</label>
            <input v-model="form.title" type="text" required placeholder="输入目标标题" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="form.description" rows="3" placeholder="输入目标描述（可选）"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>目标日期</label>
              <input v-model="form.targetDate" type="date" />
            </div>
            <div class="form-group">
              <label>初始进度</label>
              <div class="progress-input">
                <input v-model.number="form.progress" type="range" min="0" max="100" />
                <span class="progress-preview">{{ form.progress }}%</span>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="closeModal">{{ t('common.cancel') }}</button>
            <button type="submit" class="btn-primary">{{ t('common.save') }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal-content confirm-modal">
        <h2>{{ t('common.confirmDelete') }}</h2>
        <p>确定要删除「{{ deletingGoal?.title }}」吗？</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showDeleteConfirm = false">{{ t('common.cancel') }}</button>
          <button class="btn-danger" @click="deleteGoal">{{ t('common.delete') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { goalApi } from '@/api'
import type { Goal } from '@/types'

const { t } = useI18n()

const goals = ref<Goal[]>([])
const showModal = ref(false)
const showDeleteConfirm = ref(false)
const editingGoal = ref<Goal | null>(null)
const deletingGoal = ref<Goal | null>(null)

const form = ref({
  title: '',
  description: '',
  targetDate: '',
  progress: 0
})

const circumference = 2 * Math.PI * 40

const activeGoals = computed(() => goals.value.filter(g => g.status === 'active').length)
const completedGoals = computed(() => goals.value.filter(g => g.status === 'completed').length)
const averageProgress = computed(() => {
  if (goals.value.length === 0) return 0
  return Math.round(goals.value.reduce((sum, g) => sum + g.progress, 0) / goals.value.length)
})

const sortedGoals = computed(() => {
  return [...goals.value].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1
    if (a.status !== 'completed' && b.status === 'completed') return -1
    return b.progress - a.progress
  })
})

function getProgressOffset(progress: number): number {
  return circumference * (1 - progress / 100)
}

function getProgressClass(progress: number): string {
  if (progress >= 100) return 'complete'
  if (progress >= 75) return 'high'
  if (progress >= 50) return 'medium'
  return 'low'
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function getDaysLeft(date: string): number {
  const diff = new Date(date).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function isUrgent(goal: Goal): boolean {
  if (!goal.targetDate || goal.status === 'completed') return false
  const daysLeft = getDaysLeft(goal.targetDate)
  return daysLeft <= 7 && goal.progress < 80
}

function openCreateModal() {
  editingGoal.value = null
  form.value = { title: '', description: '', targetDate: '', progress: 0 }
  showModal.value = true
}

function openEditModal(goal: Goal) {
  editingGoal.value = goal
  form.value = {
    title: goal.title,
    description: goal.description || '',
    targetDate: goal.targetDate || '',
    progress: goal.progress
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingGoal.value = null
}

async function fetchGoals() {
  try {
    const res: any = await goalApi.list()
    goals.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch goals', e)
  }
}

async function saveGoal() {
  try {
    const data = {
      title: form.value.title,
      description: form.value.description,
      targetDate: form.value.targetDate || undefined,
      progress: form.value.progress
    }
    if (editingGoal.value) {
      await goalApi.progress(editingGoal.value.id, form.value.progress)
      Object.assign(editingGoal.value, data)
    } else {
      const res: any = await goalApi.create(data)
      goals.value.push(res.data)
    }
    closeModal()
  } catch (e) {
    console.error('Failed to save goal', e)
  }
}

async function updateProgress(goal: Goal, delta: number) {
  const newProgress = Math.max(0, Math.min(100, goal.progress + delta))
  try {
    await goalApi.progress(goal.id, newProgress)
    goal.progress = newProgress
    if (newProgress >= 100) {
      goal.status = 'completed'
    } else {
      goal.status = 'active'
    }
  } catch (e) {
    console.error('Failed to update progress', e)
  }
}

function confirmDelete(goal: Goal) {
  deletingGoal.value = goal
  showDeleteConfirm.value = true
}

async function deleteGoal() {
  if (!deletingGoal.value) return
  try {
    await goalApi.delete(deletingGoal.value.id)
    goals.value = goals.value.filter(g => g.id !== deletingGoal.value!.id)
    showDeleteConfirm.value = false
    deletingGoal.value = null
  } catch (e) {
    console.error('Failed to delete goal', e)
  }
}

onMounted(() => {
  fetchGoals()
})
</script>

<style scoped>
.goals-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.overview-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-lg);
}

.overview-icon {
  font-size: 32px;
}

.overview-content {
  display: flex;
  flex-direction: column;
}

.overview-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--cb-text-primary);
}

.overview-label {
  font-size: 12px;
  color: var(--cb-text-tertiary);
}

.goal-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.goal-card {
  padding: 24px;
  position: relative;
  overflow: hidden;
}

.goal-card.completed {
  background: linear-gradient(135deg, rgba(90, 138, 90, 0.05), rgba(46, 204, 113, 0.05));
}

.goal-header {
  margin-bottom: 20px;
}

.goal-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.goal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--cb-text-primary);
  cursor: pointer;
}

.goal-title:hover {
  color: var(--cb-primary);
}

.goal-status {
  padding: 4px 10px;
  border-radius: var(--cb-radius-full);
  font-size: 11px;
  font-weight: 600;
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
}

.goal-progress-section {
  display: flex;
  align-items: center;
  gap: 32px;
  margin-bottom: 20px;
}

.progress-ring {
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}

.progress-ring svg {
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: var(--cb-border);
  stroke-width: 8;
}

.ring-fill {
  fill: none;
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s ease, stroke 0.3s ease;
}

.ring-fill.low { stroke: var(--cb-danger); }
.ring-fill.medium { stroke: var(--cb-warning); }
.ring-fill.high { stroke: var(--cb-info); }
.ring-fill.complete { stroke: var(--cb-success); }

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--cb-text-primary);
}

.progress-unit {
  font-size: 12px;
  color: var(--cb-text-tertiary);
}

.milestones {
  flex: 1;
  display: flex;
  justify-content: space-between;
}

.milestone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  opacity: 0.4;
  transition: opacity 0.2s ease;
}

.milestone.reached {
  opacity: 1;
}

.milestone-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--cb-border);
  transition: all 0.2s ease;
}

.milestone.reached .milestone-dot {
  background: var(--cb-success);
  box-shadow: 0 0 8px rgba(90, 138, 90, 0.5);
}

.milestone span {
  font-size: 10px;
  color: var(--cb-text-tertiary);
}

.goal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.goal-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.target-date {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.target-date.urgent {
  color: var(--cb-danger);
}

.urgent-badge {
  padding: 2px 6px;
  background: var(--cb-danger);
  color: white;
  border-radius: var(--cb-radius-sm);
  font-size: 10px;
  font-weight: 600;
}

.days-left {
  font-size: 12px;
  color: var(--cb-text-tertiary);
}

.goal-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cb-bg-sunken);
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  cursor: pointer;
  color: var(--cb-text-secondary);
  transition: all 0.15s ease;
}

.action-btn:hover:not(:disabled) {
  background: var(--cb-sidebar-hover);
}

.action-btn.progress:hover:not(:disabled) { color: var(--cb-success); border-color: var(--cb-success); }
.action-btn.regress:hover:not(:disabled) { color: var(--cb-warning); border-color: var(--cb-warning); }
.action-btn.delete:hover { color: var(--cb-danger); border-color: var(--cb-danger); }

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.completed-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(90, 138, 90, 0.1);
  pointer-events: none;
}

.completed-badge {
  padding: 12px 24px;
  background: var(--cb-success);
  color: white;
  border-radius: var(--cb-radius-full);
  font-weight: 600;
  font-size: 18px;
  animation: celebrate 0.5s ease;
}

@keyframes celebrate {
  0% { transform: scale(0); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
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

.progress-input {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-input input {
  flex: 1;
}

.progress-preview {
  min-width: 40px;
  font-weight: 600;
  color: var(--cb-primary);
}

.goal-list-move,
.goal-list-enter-active,
.goal-list-leave-active {
  transition: all 0.3s ease;
}

.goal-list-enter-from,
.goal-list-leave-to {
  opacity: 0;
  transform: translateY(-20px);
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
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-size: var(--cb-text-base);
}

.form-group input:focus,
.form-group textarea:focus {
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
