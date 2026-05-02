<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('reminder.title') }}</h1>
        <p class="cb-page-desc">管理提醒事项</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
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
        <div class="reminder-info" @click="openEditModal(reminder)">
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
          <button class="delete-btn" @click="confirmDelete(reminder)">
            🗑
          </button>
        </div>
      </div>
    </div>

    <div v-if="reminders.length === 0" class="empty-state">
      <p>暂无提醒，点击上方按钮创建</p>
    </div>

    <!-- 创建/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h2>{{ editingReminder ? '编辑提醒' : t('reminder.newReminder') }}</h2>
        <form @submit.prevent="saveReminder">
          <div class="form-group">
            <label>{{ t('reminder.title') }}</label>
            <input v-model="form.title" type="text" required placeholder="输入提醒标题" />
          </div>
          <div class="form-group">
            <label>{{ t('reminder.content') }}</label>
            <textarea v-model="form.content" rows="3" placeholder="输入提醒内容（可选）"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>{{ t('reminder.remindAt') }}</label>
              <input v-model="form.remindAt" type="datetime-local" required />
            </div>
            <div class="form-group">
              <label>{{ t('reminder.repeat.label') }}</label>
              <select v-model="form.repeat">
                <option value="none">{{ t('reminder.repeat.none') }}</option>
                <option value="daily">{{ t('reminder.repeat.daily') }}</option>
                <option value="weekly">{{ t('reminder.repeat.weekly') }}</option>
                <option value="monthly">{{ t('reminder.repeat.monthly') }}</option>
              </select>
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
        <p>确定要删除「{{ deletingReminder?.title }}」吗？</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showDeleteConfirm = false">{{ t('common.cancel') }}</button>
          <button class="btn-danger" @click="deleteReminder">{{ t('common.delete') }}</button>
        </div>
      </div>
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
const showModal = ref(false)
const showDeleteConfirm = ref(false)
const editingReminder = ref<Reminder | null>(null)
const deletingReminder = ref<Reminder | null>(null)

const form = ref({
  title: '',
  content: '',
  remindAt: '',
  repeat: 'none' as 'none' | 'daily' | 'weekly' | 'monthly'
})

function formatDateTime(date: string): string {
  return new Date(date).toLocaleString()
}

function openCreateModal() {
  editingReminder.value = null
  form.value = { title: '', content: '', remindAt: '', repeat: 'none' }
  showModal.value = true
}

function openEditModal(reminder: Reminder) {
  editingReminder.value = reminder
  form.value = {
    title: reminder.title,
    content: reminder.content || '',
    remindAt: reminder.remindAt.slice(0, 16),
    repeat: reminder.repeat || 'none'
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingReminder.value = null
}

async function fetchReminders() {
  try {
    const res: any = await reminderApi.list()
    reminders.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch reminders', e)
  }
}

async function saveReminder() {
  try {
    const data = { ...form.value, remindAt: new Date(form.value.remindAt).toISOString() }
    if (editingReminder.value) {
      reminders.value = reminders.value.map(r => r.id === editingReminder.value!.id ? { ...r, ...data } : r)
    } else {
      const res: any = await reminderApi.create(data)
      reminders.value.push(res.data)
    }
    closeModal()
  } catch (e) {
    console.error('Failed to save reminder', e)
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

function confirmDelete(reminder: Reminder) {
  deletingReminder.value = reminder
  showDeleteConfirm.value = true
}

async function deleteReminder() {
  if (!deletingReminder.value) return
  try {
    await reminderApi.delete(deletingReminder.value.id)
    reminders.value = reminders.value.filter(r => r.id !== deletingReminder.value!.id)
    showDeleteConfirm.value = false
    deletingReminder.value = null
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
  cursor: pointer;
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