<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('reminder.title') }}</h1>
        <p class="cb-page-desc">管理提醒事项</p>
      </div>
      <button class="btn-primary" @click="showCreateModal = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('reminder.newReminder') }}
      </button>
    </div>

    <!-- 提醒列表 -->
    <div class="reminder-list">
      <div v-for="reminder in reminders" :key="reminder.id" class="cb-card reminder-item" :class="reminder.status">
        <div class="reminder-icon">🔔</div>
        <div class="reminder-info">
          <h3 class="reminder-title">{{ reminder.title }}</h3>
          <p v-if="reminder.content" class="reminder-content">{{ reminder.content }}</p>
          <div class="reminder-meta">
            <span class="remind-time">{{ formatDateTime(reminder.remindAt) }}</span>
            <span v-if="reminder.repeat && reminder.repeat !== 'none'" class="repeat-badge">
              {{ t(`reminder.repeat.${reminder.repeat}`) }}
            </span>
          </div>
        </div>
        <div class="reminder-actions">
          <button v-if="reminder.status === 'pending'" class="complete-btn" @click="completeReminder(reminder)">
            ✓
          </button>
          <button class="delete-btn" @click="deleteReminder(reminder)">
            🗑
          </button>
        </div>
      </div>
    </div>

    <div v-if="reminders.length === 0" class="empty-state">
      <p>暂无提醒，点击上方按钮创建</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { reminderApi } from '@/api'
import type { Reminder } from '@/types'

const { t } = useI18n()

const reminders = ref<Reminder[]>([])
const showCreateModal = ref(false)

function formatDateTime(date: string): string {
  return new Date(date).toLocaleString()
}

async function fetchReminders() {
  try {
    const res: any = await reminderApi.list()
    reminders.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch reminders', e)
  }
}

async function completeReminder(reminder: Reminder) {
  try {
    await reminderApi.complete(reminder.id)
    reminder.status = 'done'
  } catch (e) {
    console.error('Failed to complete reminder', e)
  }
}

async function deleteReminder(reminder: Reminder) {
  try {
    await reminderApi.delete(reminder.id)
    reminders.value = reminders.value.filter(r => r.id !== reminder.id)
  } catch (e) {
    console.error('Failed to delete reminder', e)
  }
}

onMounted(() => {
  fetchReminders()
})
</script>

<style scoped>
.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reminder-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
}

.reminder-item.done {
  opacity: 0.6;
}

.reminder-item.done .reminder-title {
  text-decoration: line-through;
}

.reminder-icon {
  font-size: 24px;
}

.reminder-info {
  flex: 1;
}

.reminder-title {
  font-weight: 500;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.reminder-content {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
  margin-bottom: 8px;
}

.reminder-meta {
  display: flex;
  gap: 8px;
  font-size: var(--cb-text-xs);
}

.remind-time {
  color: var(--cb-text-tertiary);
}

.repeat-badge {
  padding: 2px 6px;
  background: var(--cb-primary-bg);
  color: var(--cb-primary);
  border-radius: var(--cb-radius-sm);
}

.reminder-actions {
  display: flex;
  gap: 8px;
}

.complete-btn, .delete-btn {
  padding: 8px;
  border: none;
  border-radius: var(--cb-radius-sm);
  cursor: pointer;
  font-size: 16px;
}

.complete-btn {
  background: var(--cb-success);
  color: white;
}

.delete-btn {
  background: transparent;
}

.delete-btn:hover {
  background: var(--cb-danger);
}

.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--cb-text-tertiary);
}
</style>