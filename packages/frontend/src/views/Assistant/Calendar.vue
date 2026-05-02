<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('event.title') }}</h1>
        <p class="cb-page-desc">管理日程安排</p>
      </div>
      <button class="btn-primary" @click="showCreateModal = true">
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
            :class="{ 'other-month': day.otherMonth, 'has-event': day.hasEvent, today: day.isToday }"
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
        <div v-for="event in selectedDayEvents" :key="event.id" class="cb-card event-item">
          <div class="event-time">
            {{ formatTime(event.startAt) }}
          </div>
          <div class="event-info">
            <h4 class="event-title">{{ event.title }}</h4>
            <p v-if="event.location" class="event-location">📍 {{ event.location }}</p>
          </div>
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
const showCreateModal = ref(false)

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

  // 上月填充
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

  // 当月
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

  // 下月填充
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

async function fetchEvents() {
  try {
    const res: any = await eventApi.list()
    events.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch events', e)
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

.calendar-day.otherMonth {
  opacity: 0.4;
}

.calendar-day.today {
  background: var(--cb-primary);
  color: white;
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
</style>