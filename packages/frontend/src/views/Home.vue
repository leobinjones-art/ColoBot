<template>
  <div class="home-page">
    <!-- 今日状态摘要 -->
    <div class="status-summary">
      <h2>{{ t('home.todayStatus') }}</h2>
      <div class="status-grid">
        <div class="status-item">
          <span class="status-icon">😊</span>
          <span class="status-label">{{ t('home.mood') }}</span>
          <span class="status-value">{{ moodScore }}/10</span>
        </div>
        <div class="status-item">
          <span class="status-icon">📝</span>
          <span class="status-label">{{ t('home.todos') }}</span>
          <span class="status-value">{{ todoProgress }}</span>
        </div>
        <div class="status-item">
          <span class="status-icon">🏃</span>
          <span class="status-label">{{ t('home.exercise') }}</span>
          <span class="status-value">{{ exerciseChecked ? t('home.checked') : '—' }}</span>
        </div>
      </div>
      <div v-if="todayTip" class="today-tip">
        <span class="tip-icon">💡</span>
        <span>{{ todayTip }}</span>
      </div>
    </div>

    <!-- 对话区域 -->
    <div class="chat-section">
      <ChatConsole />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ChatConsole from '@/views/ChatConsole.vue'

const { t } = useI18n()

const moodScore = ref(7)
const todoTotal = ref(5)
const todoCompleted = ref(2)
const exerciseChecked = ref(true)
const todayTip = ref('你这周睡眠比上周多了 1 小时，继续保持！')

const todoProgress = computed(() => `${todoCompleted.value}/${todoTotal.value}`)

onMounted(async () => {
  // TODO: 从 API 获取今日状态数据
  // const profile = await userProfileApi.get()
  // moodScore.value = profile.psychological.overallScore / 10
})
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  padding: 16px;
}

.status-summary {
  background: var(--cb-bg-elevated);
  border: 1px solid var(--cb-border-light);
  border-radius: var(--cb-radius-lg);
  padding: 16px 20px;
}

.status-summary h2 {
  font-size: var(--cb-text-lg);
  font-weight: 500;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.status-grid {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  font-size: 20px;
}

.status-label {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.status-value {
  font-size: var(--cb-text-base);
  font-weight: 500;
  color: var(--cb-text-primary);
}

.today-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--cb-primary-bg);
  border-radius: var(--cb-radius-md);
  font-size: var(--cb-text-sm);
  color: var(--cb-primary);
}

.tip-icon {
  font-size: 16px;
}

.chat-section {
  flex: 1;
  min-height: 0;
  background: var(--cb-bg-elevated);
  border: 1px solid var(--cb-border-light);
  border-radius: var(--cb-radius-lg);
  overflow: hidden;
}
</style>