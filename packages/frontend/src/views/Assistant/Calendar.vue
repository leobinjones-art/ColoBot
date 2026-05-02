<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('event.title') }}</h1>
        <p class="cb-page-desc">管理日程安排</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('event.newEvent') }}
      </button>
    </div>

    <!-- 日历视图 -->
    <div class="calendar-section">
      <div class="calendar-header">
        <button @click="prevMonth">&lt;</button>
        <h3>{{ currentYear }}年{{ currentMonth + 1 }}月</h3>
        <button @click="nextMonth">&gt;</button>
      </div>
      <div class="calendar-grid">
        <div class="calendar-weekdays">
          <span v-for="day in weekdays" :key="day">{{ day }}</span>
        </div>
        <div class="calendar-days">
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            class="calendar-day"
            :class="{ 'other-month': day.otherMonth, 'has-event': day.hasEvent, today: day.isToday, selected: isSelectedDay(day) }"
            @click="selectDay(day)"
          >
            <span class="day-number">{{ day.date }}</span>
            <div v-if="day.events.length" class="day-events">
              <span v-for="e in day.events.slice(0, 2)" :key="e.id" class="event-dot"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 选中日期的事件 -->
    <div v-if="selectedDayEvents.length" class="events-section">
      <h3>{{ selectedDateStr }} 的日程</h3>
      <div class="event-list">
        <div v-for="event in selectedDayEvents" :key="event.id" class="cb-card event-item" @click="openEditModal(event)">
          <div class="event-time">
            {{ formatTime(event.startAt) }}
          </div>
          <div class="event-info">
            <h4 class="event-title">{{ event.title }}</h4>
            <p v-if="event.location" class="event-location">📍 {{ event.location }}</p>
          </div>
          <button class="delete-btn" @click.stop="confirmDelete(event)">🗑</button>
        </div>
      </div>
    </div>

    <div v-if="!selectedDayEvents.length && selectedDate" class="empty-state">
      <p>该日期暂无日程</p>
    </div>

    <!-- 创建/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h2>{{ editingEvent ? '编辑日程' : t('event.newEvent') }}</h2>
        <form @submit.prevent="saveEvent">
          <div class="form-group">
            <label>{{ t('event.title') }}</label>
            <input v-model="form.title" type="text" required placeholder="输入日程标题" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="form.description" rows="2" placeholder="输入描述（可选）"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>开始时间</label>
              <input v-model="form.startAt" type="datetime-local" required />
            </div>
            <div class="form-group">
              <label>结束时间</label>
              <input v-model="form.endAt" type="datetime-local" />
            </div>
          </div>
          <div class="form-group">
            <label>地点</label>
            <input v-model="form.location" type="text" placeholder="输入地点（可选）" />
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
        <p>确定要删除「{{ deletingEvent?.title }}」吗？</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showDeleteConfirm = false">{{ t('common.cancel') }}</button>
          <button class="btn-danger" @click="deleteEvent">{{ t('common.delete') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { eventApi } from '@/api'
import type { Event } from '@/types'

const { t } = useI18n()

const events = ref<Event[]>([])
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth())
const selectedDate = ref<Date | null>(null)
const showModal = ref(false)
const showDeleteConfirm = ref(false)
const editingEvent = ref<Event | null>(null)
const deletingEvent = ref<Event | null>(null)

const form = ref({
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  location: ''
})

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const calendarDays = computed(() => {
  const days: Array<{
    date: number
    otherMonth: boolean
    isToday: boolean
    hasEvent: boolean
    events: Event[]
    fullDate: Date
  }> = []

  const firstDay = new Date(currentYear.value, currentMonth.value, 1)
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0)
  const startPadding = firstDay.getDay()
  const today = new Date()

  for (let i = startPadding - 1; i >= 0; i--) {
    const d = new Date(currentYear.value, currentMonth.value, -i)
    days.push({
      date: d.getDate(),
      otherMonth: true,
      isToday: false,
      hasEvent: hasEventOnDate(d),
      events: getEventsOnDate(d),
      fullDate: d,
    })
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(currentYear.value, currentMonth.value, i)
    days.push({
      date: i,
      otherMonth: false,
      isToday: d.toDateString() === today.toDateString(),
      hasEvent: hasEventOnDate(d),
      events: getEventsOnDate(d),
      fullDate: d,
    })
  }

  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(currentYear.value, currentMonth.value + 1, i)
    days.push({
      date: i,
      otherMonth: true,
      isToday: false,
      hasEvent: hasEventOnDate(d),
      events: getEventsOnDate(d),
      fullDate: d,
    })
  }

  return days
})

const selectedDayEvents = computed(() => {
  if (!selectedDate.value) return []
  return getEventsOnDate(selectedDate.value)
})

const selectedDateStr = computed(() => {
  if (!selectedDate.value) return ''
  return selectedDate.value.toLocaleDateString()
})

function isSelectedDay(day: any): boolean {
  if (!selectedDate.value) return false
  return day.fullDate.toDateString() === selectedDate.value.toDateString()
}

function hasEventOnDate(date: Date): boolean {
  return events.value.some(e => {
    const eventDate = new Date(e.startAt)
    return eventDate.toDateString() === date.toDateString()
  })
}

function getEventsOnDate(date: Date): Event[] {
  return events.value.filter(e => {
    const eventDate = new Date(e.startAt)
    return eventDate.toDateString() === date.toDateString()
  })
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function selectDay(day: any) {
  selectedDate.value = day.fullDate
}

function openCreateModal() {
  editingEvent.value = null
  const now = new Date()
  now.setHours(10, 0, 0, 0)
  form.value = {
    title: '',
    description: '',
    startAt: now.toISOString().slice(0, 16),
    endAt: '',
    location: ''
  }
  showModal.value = true
}

function openEditModal(event: Event) {
  editingEvent.value = event
  form.value = {
    title: event.title,
    description: event.description || '',
    startAt: event.startAt.slice(0, 16),
    endAt: event.endAt?.slice(0, 16) || '',
    location: event.location || ''
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingEvent.value = null
}

async function fetchEvents() {
  try {
    const res: any = await eventApi.list()
    events.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch events', e)
  }
}

async function saveEvent() {
  try {
    const data = {
      title: form.value.title,
      description: form.value.description,
      startAt: new Date(form.value.startAt).toISOString(),
      endAt: form.value.endAt ? new Date(form.value.endAt).toISOString() : undefined,
      location: form.value.location
    }
    if (editingEvent.value) {
      await eventApi.update(editingEvent.value.id, data)
      events.value = events.value.map(e => e.id === editingEvent.value!.id ? { ...e, ...data } : e)
    } else {
      const res: any = await eventApi.create(data)
      events.value.push(res.data)
    }
    closeModal()
  } catch (e) {
    console.error('Failed to save event', e)
  }
}

function confirmDelete(event: Event) {
  deletingEvent.value = event
  showDeleteConfirm.value = true
}

async function deleteEvent() {
  if (!deletingEvent.value) return
  try {
    await eventApi.delete(deletingEvent.value.id)
    events.value = events.value.filter(e => e.id !== deletingEvent.value!.id)
    showDeleteConfirm.value = false
    deletingEvent.value = null
  } catch (e) {
    console.error('Failed to delete event', e)
  }
}

onMounted(() => {
  fetchEvents()
})
</script>

<style scoped>
.calendar-section {
  background: var(--cb-bg-elevated);
  border-radius: var(--cb-radius-lg);
  padding: 16px;
  margin-bottom: 24px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.calendar-header h3 {
  font-size: var(--cb-text-lg);
  font-weight: 600;
  color: var(--cb-text-primary);
}

.calendar-header button {
  padding: 8px 16px;
  background: var(--cb-bg-sunken);
  border: none;
  border-radius: var(--cb-radius-md);
  cursor: pointer;
  font-size: var(--cb-text-lg);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 8px;
}

.calendar-weekdays span {
  padding: 8px;
  font-size: var(--cb-text-sm);
  color: var(--cb-text-tertiary);
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: var(--cb-radius-md);
  cursor: pointer;
  transition: background 0.15s ease;
}

.calendar-day:hover {
  background: var(--cb-sidebar-hover);
}

.calendar-day.other-month {
  opacity: 0.4;
}

.calendar-day.today {
  background: var(--cb-primary);
  color: white;
}

.calendar-day.selected {
  box-shadow: 0 0 0 2px var(--cb-primary);
}

.calendar-day.has-event {
  font-weight: 600;
}

.day-number {
  font-size: var(--cb-text-sm);
}

.day-events {
  display: flex;
  gap: 2px;
  margin-top: 2px;
}

.event-dot {
  width: 4px;
  height: 4px;
  background: var(--cb-primary);
  border-radius: 50%;
}

.calendar-day.today .event-dot {
  background: white;
}

.events-section h3 {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
}

.event-time {
  font-weight: 600;
  color: var(--cb-primary);
  min-width: 60px;
}

.event-info {
  flex: 1;
}

.event-title {
  font-weight: 500;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.event-location {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.delete-btn {
  padding: 8px;
  background: transparent;
  border: none;
  font-size: 14px;
  cursor: pointer;
}

.delete-btn:hover {
  color: var(--cb-danger);
}

.empty-state {
  text-align: center;
  padding: 24px;
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
.form-group textarea,
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
.form-group textarea:focus,
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