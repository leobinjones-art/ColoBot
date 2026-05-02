<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('todo.title') }}</h1>
        <p class="cb-page-desc">管理待办事项</p>
      </div>
      <button class="btn-primary" @click="showCreateModal = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('todo.newTodo') }}
      </button>
    </div>

    <!-- 筛选 -->
    <div class="filter-bar">
      <select v-model="filter.status">
        <option value="">{{ t('common.enabled') }}</option>
        <option value="pending">{{ t('todo.status.pending') }}</option>
        <option value="doing">{{ t('todo.status.doing') }}</option>
        <option value="done">{{ t('todo.status.done') }}</option>
      </select>
      <select v-model="filter.priority">
        <option value="">{{ t('todo.priority.high') }}/{{ t('todo.priority.medium') }}/{{ t('todo.priority.low') }}</option>
        <option value="high">{{ t('todo.priority.high') }}</option>
        <option value="medium">{{ t('todo.priority.medium') }}</option>
        <option value="low">{{ t('todo.priority.low') }}</option>
      </select>
    </div>

    <!-- 待办列表 -->
    <div class="todo-list">
      <div v-for="todo in filteredTodos" :key="todo.id" class="cb-card todo-item" :class="todo.status">
        <div class="todo-checkbox" @click="toggleComplete(todo)">
          <svg v-if="todo.status === 'done'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="todo-content">
          <h3 class="todo-title">{{ todo.title }}</h3>
          <p v-if="todo.description" class="todo-desc">{{ todo.description }}</p>
          <div class="todo-meta">
            <span class="priority" :class="todo.priority">{{ t(`todo.priority.${todo.priority}`) }}</span>
            <span v-if="todo.dueDate" class="due-date">{{ formatDate(todo.dueDate) }}</span>
          </div>
        </div>
        <button class="delete-btn" @click="deleteTodo(todo)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="todos.length === 0" class="empty-state">
      <p>暂无待办事项</p>
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
const showCreateModal = ref(false)
const filter = ref({ status: '', priority: '' })

const filteredTodos = computed(() => {
  return todos.value.filter(todo => {
    if (filter.value.status && todo.status !== filter.value.status) return false
    if (filter.value.priority && todo.priority !== filter.value.priority) return false
    return true
  })
})

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString()
}

async function fetchTodos() {
  try {
    const res: any = await todoApi.list()
    todos.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch todos', e)
  }
}

async function toggleComplete(todo: Todo) {
  if (todo.status === 'done') {
    await todoApi.update(todo.id, { status: 'pending' })
    todo.status = 'pending'
  } else {
    await todoApi.complete(todo.id)
    todo.status = 'done'
  }
}

async function deleteTodo(todo: Todo) {
  await todoApi.delete(todo.id)
  todos.value = todos.value.filter(t => t.id !== todo.id)
}

onMounted(() => {
  fetchTodos()
})
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.filter-bar select {
  padding: 8px 12px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
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
}

.todo-checkbox:hover {
  border-color: var(--cb-primary);
}

.todo-item.done .todo-checkbox {
  background: var(--cb-success);
  border-color: var(--cb-success);
  color: white;
}

.todo-content {
  flex: 1;
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
}

.priority {
  padding: 2px 8px;
  border-radius: var(--cb-radius-sm);
  background: var(--cb-bg-sunken);
}

.priority.high {
  background: var(--cb-danger);
  color: white;
}

.priority.medium {
  background: var(--cb-warning);
}

.priority.low {
  background: var(--cb-info);
  color: white;
}

.due-date {
  color: var(--cb-text-tertiary);
}

.delete-btn {
  padding: 8px;
  background: transparent;
  border: none;
  color: var(--cb-text-tertiary);
  cursor: pointer;
  border-radius: var(--cb-radius-sm);
}

.delete-btn:hover {
  background: var(--cb-danger);
  color: white;
}

.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--cb-text-tertiary);
}
</style>