<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('sentinel.title') }}</h1>
        <p class="cb-page-desc">安全守护状态监控</p>
      </div>
    </div>

    <!-- 状态卡片 -->
    <div class="status-grid">
      <div class="cb-card status-card">
        <div class="status-header">
          <span class="status-dot" :class="status?.status || 'healthy'"></span>
          <span class="status-label">{{ t('sentinel.status') }}</span>
        </div>
        <div class="status-value">{{ status?.status || 'healthy' }}</div>
      </div>

      <div class="cb-card status-card">
        <div class="status-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span>{{ t('sentinel.agentsMonitored') }}</span>
        </div>
        <div class="status-value">{{ status?.agentsMonitored || 0 }}</div>
      </div>

      <div class="cb-card status-card">
        <div class="status-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>{{ t('sentinel.activeSessions') }}</span>
        </div>
        <div class="status-value">{{ status?.activeSessions || 0 }}</div>
      </div>

      <div class="cb-card status-card">
        <div class="status-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>{{ t('sentinel.recentTakeovers') }}</span>
        </div>
        <div class="status-value">{{ status?.recentTakeovers || 0 }}</div>
      </div>
    </div>

    <!-- 会话列表 -->
    <div class="cb-card">
      <h3 class="section-title">{{ t('sentinel.sessions') }}</h3>
      <div class="session-list">
        <div v-for="session in sessions" :key="session.sessionId" class="session-item">
          <div class="session-info">
            <span class="session-id">{{ session.sessionId }}</span>
            <span class="session-agent">{{ session.agentId }}</span>
          </div>
          <span class="status-dot" :class="session.status"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { sentinelApi } from '@/api'
import type { SentinelStatus, SentinelSession } from '@/types'

const { t } = useI18n()

const status = ref<SentinelStatus | null>(null)
const sessions = ref<SentinelSession[]>([])

async function fetchStatus() {
  try {
    const res: any = await sentinelApi.status()
    status.value = res.data
  } catch (e) {
    console.error('Failed to fetch sentinel status', e)
  }
}

async function fetchSessions() {
  try {
    const res: any = await sentinelApi.sessions()
    sessions.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch sessions', e)
  }
}

onMounted(() => {
  fetchStatus()
  fetchSessions()
})
</script>

<style scoped>
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.status-card {
  padding: 20px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.status-value {
  font-size: var(--cb-text-xl);
  font-weight: 600;
  color: var(--cb-text-primary);
}

.section-title {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
}

.session-info {
  display: flex;
  gap: 16px;
}

.session-id {
  font-weight: 500;
  color: var(--cb-text-primary);
}

.session-agent {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}
</style>