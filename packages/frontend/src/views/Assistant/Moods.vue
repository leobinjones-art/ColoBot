<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('mood.title') }}</h1>
        <p class="cb-page-desc">记录每日心情变化</p>
      </div>
    </div>

    <!-- 心情选择 -->
    <div class="mood-selector cb-card">
      <h3>今天心情如何？</h3>
      <div class="mood-options">
        <button
          v-for="mood in moodOptions"
          :key="mood.value"
          class="mood-btn"
          :class="{ active: selectedMood === mood.value }"
          @click="selectMood(mood.value)"
        >
          <span class="mood-emoji">{{ mood.emoji }}</span>
          <span class="mood-label">{{ t(`mood.${mood.value}`) }}</span>
        </button>
      </div>
      <div v-if="selectedMood" class="score-slider">
        <label>程度：{{ score }}/10</label>
        <input type="range" v-model="score" min="1" max="10" />
      </div>
      <textarea
        v-if="selectedMood"
        v-model="note"
        placeholder="记录一下今天的心情..."
        rows="3"
      ></textarea>
      <button v-if="selectedMood" class="btn-primary" @click="saveMood">
        保存
      </button>
    </div>

    <!-- 心情历史 -->
    <div class="mood-history">
      <h3>最近记录</h3>
      <div class="mood-list">
        <div v-for="mood in moods" :key="mood.id" class="mood-item cb-card">
          <span class="mood-emoji-lg">{{ getMoodEmoji(mood.mood) }}</span>
          <div class="mood-info">
            <div class="mood-name">{{ t(`mood.${mood.mood}`) }} - {{ mood.score }}/10</div>
            <div class="mood-note" v-if="mood.note">{{ mood.note }}</div>
            <div class="mood-date">{{ formatDate(mood.loggedAt) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { moodApi } from '@/api'
import type { Mood } from '@/types'

const { t } = useI18n()

const moodOptions = [
  { value: 'happy', emoji: '😊' },
  { value: 'neutral', emoji: '😐' },
  { value: 'sad', emoji: '😢' },
  { value: 'angry', emoji: '😠' },
  { value: 'anxious', emoji: '😰' },
]

const selectedMood = ref<string | null>(null)
const score = ref(5)
const note = ref('')
const moods = ref<Mood[]>([])

function selectMood(mood: string) {
  selectedMood.value = mood
}

function getMoodEmoji(mood: string): string {
  return moodOptions.find(m => m.value === mood)?.emoji || '😐'
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString()
}

async function saveMood() {
  if (!selectedMood.value) return

  try {
    await moodApi.create({
      mood: selectedMood.value,
      score: score.value,
      note: note.value,
    })
    selectedMood.value = null
    score.value = 5
    note.value = ''
    fetchMoods()
  } catch (e) {
    console.error('Failed to save mood', e)
  }
}

async function fetchMoods() {
  try {
    const res: any = await moodApi.list({ limit: 10 })
    moods.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch moods', e)
  }
}

onMounted(() => {
  fetchMoods()
})
</script>

<style scoped>
.mood-selector {
  margin-bottom: 24px;
}

.mood-selector h3 {
  font-size: var(--cb-text-lg);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.mood-options {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.mood-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px;
  background: var(--cb-bg-sunken);
  border: 2px solid transparent;
  border-radius: var(--cb-radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.mood-btn:hover {
  background: var(--cb-sidebar-hover);
}

.mood-btn.active {
  border-color: var(--cb-primary);
  background: var(--cb-primary-bg);
}

.mood-emoji {
  font-size: 32px;
}

.mood-label {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-secondary);
}

.score-slider {
  margin-bottom: 16px;
}

.score-slider label {
  display: block;
  margin-bottom: 8px;
  color: var(--cb-text-secondary);
}

.score-slider input {
  width: 100%;
}

.mood-selector textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  margin-bottom: 16px;
  font-family: inherit;
}

.mood-history h3 {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.mood-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mood-item {
  display: flex;
  gap: 12px;
  padding: 12px;
}

.mood-emoji-lg {
  font-size: 32px;
}

.mood-info {
  flex: 1;
}

.mood-name {
  font-weight: 500;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.mood-note {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
  margin-bottom: 4px;
}

.mood-date {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}
</style>