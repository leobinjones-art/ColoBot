<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('todo.title') }}</h1>
        <p class="cb-page-desc">管理待办事项</p>
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
        {{ t('todo.newTodo') }}
      </button>
    </div>

    <!-- 进度概览 -->
    <div class="progress-overview">
      <div class="overview-ring">
        <svg viewBox="0 0 100 100">
          <circle class="ring-bg" cx="50" cy="50" r="40" />
          <circle
            class="ring-progress"
            cx="50"
            cy="50"
            r="40"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="progressOffset"
          />
        </svg>
        <div class="ring-center">
          <span class="ring-value">{{ completedPercent }}%</span>
          <span class="ring-label">完成率</span>
        </div>
      </div>
      <div class="overview-stats">
        <div class="stat-item">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">全部任务</span>
        </div>
        <div class="stat-item">
          <span class="stat-value doing">{{ stats.doing }}</span>
          <span class="stat-label">进行中</span>
        </div>
        <div class="stat-item">
          <span class="stat-value done">{{ stats.done }}</span>
          <span class="stat-label">已完成</span>
        </div>
        <div class="stat-item">
          <span class="stat-value overdue">{{ stats.overdue }}</span>
          <span class="stat-label">已逾期</span>
        </div>
      </div>
    </div>

    <!-- 快速筛选 -->
    <div class="quick-filters">
      <button
        class="filter-chip"
        :class="{ active: filter.status === '' }"
        @click="filter.status = ''"
      >
        全部
      </button>
      <button
        class="filter-chip"
        :class="{ active: filter.status === 'pending' }"
        @click="filter.status = 'pending'"
      >
        待处理
      </button>
      <button
        class="filter-chip"
        :class="{ active: filter.status === 'doing' }"
        @click="filter.status = 'doing'"
      >
        进行中
      </button>
      <button
        class="filter-chip"
        :class="{ active: filter.status === 'done' }"
        @click="filter.status = 'done'"
      >
        已完成
      </button>
      <div class="filter-divider"></div>
      <button
        class="filter-chip priority-high"
        :class="{ active: filter.priority === 'high' }"
        @click="filter.priority = filter.priority === 'high' ? '' : 'high'"
      >
        高优先
      </button>
      <button
        class="filter-chip priority-medium"
        :class="{ active: filter.priority === 'medium' }"
        @click="filter.priority = filter.priority === 'medium' ? '' : 'medium'"
      >
        中优先
      </button>
      <button
        class="filter-chip priority-low"
        :class="{ active: filter.priority === 'low' }"
        @click="filter.priority = filter.priority === 'low' ? '' : 'low'"
      >
        低优先
      </button>
    </div>

    <!-- 待办列表 -->
    <div class="todo-list" :class="viewMode">
      <TransitionGroup name="todo-list">
        <div
          v-for="todo in filteredTodos"
          :key="todo.id"
          class="cb-card todo-item"
          :class="[todo.status, `priority-${todo.priority}`]"
        >
          <div class="todo-checkbox" @click="toggleComplete(todo)">
            <svg
              v-if="todo.status === 'done'"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div v-else-if="todo.status === 'doing'" class="doing-indicator"></div>
          </div>
          <div class="todo-content" @click="openEditModal(todo)">
            <h3 class="todo-title">{{ todo.title }}</h3>
            <p v-if="todo.description" class="todo-desc">{{ todo.description }}</p>
            <div class="todo-meta">
              <span class="priority-badge" :class="todo.priority">{{
                t(`todo.priority.${todo.priority}`)
              }}</span>
              <span v-if="todo.dueDate" class="due-date" :class="{ overdue: isOverdue(todo) }">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {{ formatDate(todo.dueDate) }}
              </span>
              <span v-if="todo.tags?.length" class="tags">
                <span v-for="tag in todo.tags" :key="tag" class="tag">{{ tag }}</span>
              </span>
            </div>
          </div>
          <div class="todo-actions">
            <button
              v-if="todo.status !== 'doing'"
              class="action-btn start"
              @click.stop="startTodo(todo)"
              title="开始"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </button>
            <button
              v-if="todo.status === 'doing'"
              class="action-btn pause"
              @click.stop="pauseTodo(todo)"
              title="暂停"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </button>
            <button class="action-btn delete" @click.stop="confirmDelete(todo)" title="删除">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path
                  d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                />
              </svg>
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <div v-if="todos.length === 0" class="empty-state">
      <div class="empty-icon">📋</div>
      <p>暂无待办事项</p>
      <button class="btn-secondary" @click="openCreateModal">创建第一个任务</button>
    </div>

    <!-- 创建/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h2>{{ editingTodo ? t('todo.editTodo') : t('todo.newTodo') }}</h2>
        <form @submit.prevent="saveTodo">
          <div class="form-group">
            <label>{{ t('todo.title') }}</label>
            <input v-model="form.title" type="text" required placeholder="输入待办标题" />
          </div>
          <div class="form-group">
            <label>{{ t('todo.description') }}</label>
            <textarea v-model="form.description" rows="3" placeholder="输入描述（可选）"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>{{ t('todo.priority.label') }}</label>
              <div class="priority-selector">
                <button
                  type="button"
                  class="priority-opt low"
                  :class="{ active: form.priority === 'low' }"
                  @click="form.priority = 'low'"
                >
                  低
                </button>
                <button
                  type="button"
                  class="priority-opt medium"
                  :class="{ active: form.priority === 'medium' }"
                  @click="form.priority = 'medium'"
                >
                  中
                </button>
                <button
                  type="button"
                  class="priority-opt high"
                  :class="{ active: form.priority === 'high' }"
                  @click="form.priority = 'high'"
                >
                  高
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>{{ t('todo.dueDate') }}</label>
              <input v-model="form.dueDate" type="date" />
            </div>
          </div>
          <div class="form-group">
            <label>标签</label>
            <input v-model="form.tagsInput" type="text" placeholder="标签1, 标签2, ..." />
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
        <p>确定要删除「{{ deletingTodo?.title }}」吗？</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showDeleteConfirm = false">
            {{ t('common.cancel') }}
          </button>
          <button class="btn-danger" @click="deleteTodo">{{ t('common.delete') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { todoApi } from '@/api'
import type { Todo } from '@/types'

const { t } = useI18n()

const todos = ref<Todo[]>([])
const showModal = ref(false)
const showDeleteConfirm = ref(false)
const editingTodo = ref<Todo | null>(null)
const deletingTodo = ref<Todo | null>(null)
const filter = ref({ status: '', priority: '' })
const viewMode = ref('list')

const form = ref({
  title: '',
  description: '',
  priority: 'medium' as 'low' | 'medium' | 'high',
  dueDate: '',
  tagsInput: '',
})

const circumference = 2 * Math.PI * 40

const stats = computed(() => {
  const total = todos.value.length
  const done = todos.value.filter((t) => t.status === 'done').length
  const doing = todos.value.filter((t) => t.status === 'doing').length
  const overdue = todos.value.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done',
  ).length
  return { total, done, doing, overdue }
})

const completedPercent = computed(() => {
  if (todos.value.length === 0) return 0
  return Math.round((stats.value.done / todos.value.length) * 100)
})

const progressOffset = computed(() => {
  const progress = completedPercent.value / 100
  return circumference * (1 - progress)
})

const filteredTodos = computed(() => {
  return todos.value
    .filter((todo) => {
      if (filter.value.status && todo.status !== filter.value.status) return false
      if (filter.value.priority && todo.priority !== filter.value.priority) return false
      return true
    })
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
})

function isOverdue(todo: Todo): boolean {
  return !!(todo.dueDate && new Date(todo.dueDate) < new Date() && todo.status !== 'done')
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString()
}

function openCreateModal() {
  editingTodo.value = null
  form.value = { title: '', description: '', priority: 'medium', dueDate: '', tagsInput: '' }
  showModal.value = true
}

function openEditModal(todo: Todo) {
  editingTodo.value = todo
  form.value = {
    title: todo.title,
    description: todo.description || '',
    priority: todo.priority,
    dueDate: todo.dueDate || '',
    tagsInput: (todo.tags || []).join(', '),
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingTodo.value = null
}

async function fetchTodos() {
  try {
    const res: any = await todoApi.list()
    todos.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch todos', e)
  }
}

async function saveTodo() {
  try {
    const tags = form.value.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const data = { ...form.value, tags }

    if (editingTodo.value) {
      await todoApi.update(editingTodo.value.id, data)
      Object.assign(editingTodo.value, data)
    } else {
      const res: any = await todoApi.create(data)
      todos.value.push(res.data)
    }
    closeModal()
  } catch (e) {
    console.error('Failed to save todo', e)
  }
}

async function toggleComplete(todo: Todo) {
  try {
    if (todo.status === 'done') {
      await todoApi.update(todo.id, { status: 'pending' })
      todo.status = 'pending'
    } else {
      await todoApi.complete(todo.id)
      todo.status = 'done'
    }
  } catch (e) {
    console.error('Failed to toggle todo', e)
  }
}

async function startTodo(todo: Todo) {
  await todoApi.update(todo.id, { status: 'doing' })
  todo.status = 'doing'
}

async function pauseTodo(todo: Todo) {
  await todoApi.update(todo.id, { status: 'pending' })
  todo.status = 'pending'
}

function confirmDelete(todo: Todo) {
  deletingTodo.value = todo
  showDeleteConfirm.value = true
}

async function deleteTodo() {
  if (!deletingTodo.value) return
  try {
    await todoApi.delete(deletingTodo.value.id)
    todos.value = todos.value.filter((t) => t.id !== deletingTodo.value!.id)
    showDeleteConfirm.value = false
    deletingTodo.value = null
  } catch (e) {
    console.error('Failed to delete todo', e)
  }
}

onMounted(() => {
  fetchTodos()
})
</script>

<style scoped>
.progress-overview {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 24px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-lg);
  margin-bottom: 24px;
}

.overview-ring {
  position: relative;
  width: 120px;
  height: 120px;
}

.overview-ring svg {
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: var(--cb-border);
  stroke-width: 8;
}

.ring-progress {
  fill: none;
  stroke: var(--cb-success);
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s ease;
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ring-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--cb-text-primary);
}

.ring-label {
  font-size: 12px;
  color: var(--cb-text-tertiary);
}

.overview-stats {
  display: flex;
  gap: 32px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--cb-text-primary);
}

.stat-value.doing {
  color: var(--cb-warning);
}
.stat-value.done {
  color: var(--cb-success);
}
.stat-value.overdue {
  color: var(--cb-danger);
}

.stat-label {
  font-size: 12px;
  color: var(--cb-text-tertiary);
}

.quick-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-chip {
  padding: 6px 14px;
  background: var(--cb-bg-sunken);
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-full);
  font-size: 13px;
  color: var(--cb-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-chip:hover {
  background: var(--cb-sidebar-hover);
}

.filter-chip.active {
  background: var(--cb-primary);
  border-color: var(--cb-primary);
  color: white;
}

.filter-chip.priority-high.active {
  background: var(--cb-danger);
  border-color: var(--cb-danger);
}
.filter-chip.priority-medium.active {
  background: var(--cb-warning);
  border-color: var(--cb-warning);
}
.filter-chip.priority-low.active {
  background: var(--cb-info);
  border-color: var(--cb-info);
}

.filter-divider {
  width: 1px;
  height: 24px;
  background: var(--cb-border);
  margin: 0 8px;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
}

.todo-item.priority-high {
  border-left-color: var(--cb-danger);
}
.todo-item.priority-medium {
  border-left-color: var(--cb-warning);
}
.todo-item.priority-low {
  border-left-color: var(--cb-info);
}

.todo-item.done {
  opacity: 0.6;
}

.todo-item.done .todo-title {
  text-decoration: line-through;
}

.todo-checkbox {
  width: 24px;
  height: 24px;
  border: 2px solid var(--cb-border);
  border-radius: var(--cb-radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.todo-checkbox:hover {
  border-color: var(--cb-primary);
}

.todo-item.done .todo-checkbox {
  background: var(--cb-success);
  border-color: var(--cb-success);
  color: white;
}

.todo-item.doing .todo-checkbox {
  border-color: var(--cb-warning);
}

.doing-indicator {
  width: 12px;
  height: 12px;
  border: 2px solid var(--cb-warning);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.todo-content {
  flex: 1;
  cursor: pointer;
}

.todo-title {
  font-weight: 500;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.todo-desc {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
  margin-bottom: 8px;
}

.todo-meta {
  display: flex;
  gap: 8px;
  font-size: var(--cb-text-xs);
  align-items: center;
  flex-wrap: wrap;
}

.priority-badge {
  padding: 2px 8px;
  border-radius: var(--cb-radius-sm);
  font-weight: 500;
}

.priority-badge.high {
  background: rgba(192, 57, 43, 0.15);
  color: var(--cb-danger);
}

.priority-badge.medium {
  background: rgba(243, 156, 18, 0.15);
  color: var(--cb-warning);
}

.priority-badge.low {
  background: rgba(52, 152, 219, 0.15);
  color: var(--cb-info);
}

.due-date {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--cb-text-tertiary);
}

.due-date.overdue {
  color: var(--cb-danger);
}

.tags {
  display: flex;
  gap: 4px;
}

.tag {
  padding: 2px 6px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-sm);
  color: var(--cb-text-secondary);
}

.todo-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.todo-item:hover .todo-actions {
  opacity: 1;
}

.action-btn {
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: var(--cb-radius-sm);
  cursor: pointer;
  color: var(--cb-text-tertiary);
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--cb-bg-sunken);
}

.action-btn.start:hover {
  color: var(--cb-success);
}
.action-btn.pause:hover {
  color: var(--cb-warning);
}
.action-btn.delete:hover {
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

.todo-list-move,
.todo-list-enter-active,
.todo-list-leave-active {
  transition: all 0.3s ease;
}

.todo-list-enter-from,
.todo-list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.priority-selector {
  display: flex;
  gap: 4px;
}

.priority-opt {
  flex: 1;
  padding: 8px;
  background: var(--cb-bg-sunken);
  border: 2px solid transparent;
  border-radius: var(--cb-radius-sm);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s ease;
}

.priority-opt.low.active {
  border-color: var(--cb-info);
  background: rgba(52, 152, 219, 0.1);
}
.priority-opt.medium.active {
  border-color: var(--cb-warning);
  background: rgba(243, 156, 18, 0.1);
}
.priority-opt.high.active {
  border-color: var(--cb-danger);
  background: rgba(192, 57, 43, 0.1);
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
.form-group select,
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
.form-group select:focus,
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
