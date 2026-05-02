<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('sentinel.title') }}</h1>
        <p class="cb-page-desc">安全守护状态监控</p>
      </div>
      <div class="header-actions">
        <span class="live-indicator" :class="status?.status || 'healthy'">
          <span class="live-dot"></span>
          实时监控中
        </span>
        <button class="btn-secondary" @click="refreshAll" :disabled="isRefreshing">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ spinning: isRefreshing }">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          刷新
        </button>
      </div>
    </div>

    <!-- 状态卡片 -->
    <div class="status-grid">
      <div class="cb-card status-card">
        <div class="status-header">
          <span class="status-dot" :class="status?.status || 'healthy'"></span>
          <span class="status-label">{{ t('sentinel.status') }}</span>
        </div>
        <div class="status-value" :class="status?.status || 'healthy'">
          {{ statusText }}
        </div>
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
        <div class="status-value warning">{{ status?.recentTakeovers || 0 }}</div>
      </div>
    </div>

    <!-- 三层防御状态 -->
    <div class="defense-layers">
      <h3 class="section-title">三层防御体系</h3>
      <div class="layers-grid">
        <div class="cb-card layer-card">
          <div class="layer-header">
            <span class="layer-icon">⚡</span>
            <span class="layer-name">规则引擎</span>
            <span class="layer-status active">运行中</span>
          </div>
          <div class="layer-stats">
            <div class="stat">
              <span class="stat-value">{{ defenseStats.ruleCount }}</span>
              <span class="stat-label">规则数</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ defenseStats.ruleHits }}</span>
              <span class="stat-label">今日拦截</span>
            </div>
          </div>
          <p class="layer-desc">Trie树敏感词 + 正则模式，&lt;1ms 同步扫描</p>
        </div>

        <div class="cb-card layer-card">
          <div class="layer-header">
            <span class="layer-icon">🧠</span>
            <span class="layer-name">本地模型</span>
            <span class="layer-status active">运行中</span>
          </div>
          <div class="layer-stats">
            <div class="stat">
              <span class="stat-value">{{ defenseStats.modelChecks }}</span>
              <span class="stat-label">今日检测</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ defenseStats.modelFlags }}</span>
              <span class="stat-label">标记异常</span>
            </div>
          </div>
          <p class="layer-desc">ONNX 分类器，异步检测语义风险</p>
        </div>

        <div class="cb-card layer-card">
          <div class="layer-header">
            <span class="layer-icon">🛡️</span>
            <span class="layer-name">LLM 接管</span>
            <span class="layer-status standby">待命</span>
          </div>
          <div class="layer-stats">
            <div class="stat">
              <span class="stat-value">{{ defenseStats.takeovers }}</span>
              <span class="stat-label">今日接管</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ defenseStats.recovered }}</span>
              <span class="stat-label">成功恢复</span>
            </div>
          </div>
          <p class="layer-desc">最终防线，生成接管回复</p>
        </div>
      </div>
    </div>

    <!-- 活跃会话 -->
    <div class="cb-card sessions-card">
      <div class="card-header">
        <h3 class="section-title">{{ t('sentinel.sessions') }}</h3>
        <span class="session-count">{{ sessions.length }} 个活跃</span>
      </div>
      <div class="session-list">
        <div v-for="session in sessions" :key="session.sessionId" class="session-item">
          <div class="session-main">
            <div class="session-info">
              <span class="session-id">{{ session.sessionId.slice(0, 8) }}</span>
              <span class="session-agent">{{ session.agentId }}</span>
            </div>
            <div class="session-meta">
              <span class="session-phase">{{ session.currentPhase }}</span>
              <span class="session-time">{{ formatTime(session.lastHeartbeat) }}</span>
            </div>
          </div>
          <div class="session-status">
            <span class="status-dot" :class="session.status"></span>
            <span class="status-text">{{ sessionStatusText(session.status) }}</span>
          </div>
        </div>
        <div v-if="sessions.length === 0" class="empty-sessions">
          <span class="empty-icon">🛡️</span>
          <span>暂无活跃会话</span>
        </div>
      </div>
    </div>

    <!-- 接管历史 -->
    <div class="cb-card history-card">
      <div class="card-header">
        <h3 class="section-title">接管历史</h3>
        <span class="history-count">最近 24 小时</span>
      </div>
      <div class="history-list">
        <div v-for="record in takeoverHistory" :key="record.id" class="history-item">
          <div class="history-icon" :class="record.severity">
            {{ record.severity === 'high' ? '🚨' : record.severity === 'medium' ? '⚠️' : 'ℹ️' }}
          </div>
          <div class="history-content">
            <div class="history-title">{{ record.reason }}</div>
            <div class="history-meta">
              <span>{{ record.agentId }}</span>
              <span>·</span>
              <span>{{ formatTime(record.timestamp) }}</span>
            </div>
          </div>
          <span class="history-action" :class="record.action">{{ actionText(record.action) }}</span>
        </div>
        <div v-if="takeoverHistory.length === 0" class="empty-history">
          <span>✅ 无异常记录</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { sentinelApi } from '@/api'
import type { SentinelStatus, SentinelSession } from '@/types'

const { t } = useI18n()

const status = ref<SentinelStatus | null>(null)
const sessions = ref<SentinelSession[]>([])
const isRefreshing = ref(false)

const defenseStats = ref({
  ruleCount: 156,
  ruleHits: 23,
  modelChecks: 1847,
  modelFlags: 5,
  takeovers: 2,
  recovered: 2,
})

const takeoverHistory = ref([
  { id: '1', agentId: 'agent-1', reason: '响应超时 60 秒', severity: 'high', action: 'taken_over', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: '2', agentId: 'agent-2', reason: '检测到敏感信息泄露', severity: 'medium', action: 'blocked', timestamp: new Date(Date.now() - 7200000).toISOString() },
])

const statusText = computed(() => {
  const s = status?.value?.status || 'healthy'
  return t(`sentinel.${s}`)
})

let refreshInterval: ReturnType<typeof setInterval> | null = null

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

async function refreshAll() {
  isRefreshing.value = true
  await Promise.all([fetchStatus(), fetchSessions()])
  isRefreshing.value = false
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return `${diff}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return date.toLocaleDateString()
}

function sessionStatusText(s: string): string {
  const map: Record<string, string> = {
    active: '活跃',
    timeout: '超时',
    taken_over: '已接管',
  }
  return map[s] || s
}

function actionText(a: string): string {
  const map: Record<string, string> = {
    taken_over: '已接管',
    blocked: '已拦截',
    recovered: '已恢复',
  }
  return map[a] || a
}

onMounted(() => {
  fetchStatus()
  fetchSessions()
  refreshInterval = setInterval(() => {
    fetchStatus()
    fetchSessions()
  }, 5000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<style scoped>
.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(34, 197, 94, 0.1);
  border-radius: var(--cb-radius-full);
  font-size: 13px;
  color: var(--cb-success);
}

.live-indicator.warning {
  background: rgba(245, 158, 11, 0.1);
  color: var(--cb-warning);
}

.live-indicator.critical {
  background: rgba(239, 68, 68, 0.1);
  color: var(--cb-danger);
}

.live-dot {
  width: 8px;
  height: 8px;
  background: currentColor;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

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

.status-value.healthy { color: var(--cb-success); }
.status-value.warning { color: var(--cb-warning); }
.status-value.critical { color: var(--cb-danger); }

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--cb-success);
}

.status-dot.warning { background: var(--cb-warning); }
.status-dot.critical { background: var(--cb-danger); }
.status-dot.active { background: var(--cb-success); animation: pulse 2s infinite; }
.status-dot.timeout { background: var(--cb-warning); }
.status-dot.taken_over { background: var(--cb-danger); }

.section-title {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
}

/* 三层防御 */
.defense-layers {
  margin-bottom: 24px;
}

.layers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.layer-card {
  padding: 20px;
}

.layer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.layer-icon {
  font-size: 24px;
}

.layer-name {
  flex: 1;
  font-weight: 600;
  color: var(--cb-text-primary);
}

.layer-status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: var(--cb-radius-sm);
}

.layer-status.active {
  background: rgba(34, 197, 94, 0.1);
  color: var(--cb-success);
}

.layer-status.standby {
  background: rgba(59, 130, 246, 0.1);
  color: var(--cb-info);
}

.layer-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
}

.layer-stats .stat {
  display: flex;
  flex-direction: column;
}

.layer-stats .stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--cb-text-primary);
}

.layer-stats .stat-label {
  font-size: 12px;
  color: var(--cb-text-tertiary);
}

.layer-desc {
  font-size: 12px;
  color: var(--cb-text-secondary);
}

/* 会话列表 */
.sessions-card, .history-card {
  padding: 20px;
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.session-count, .history-count {
  font-size: 12px;
  color: var(--cb-text-tertiary);
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

.session-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-info {
  display: flex;
  gap: 12px;
  align-items: center;
}

.session-id {
  font-weight: 500;
  color: var(--cb-text-primary);
  font-family: monospace;
}

.session-agent {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.session-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.session-phase {
  padding: 2px 8px;
  background: var(--cb-bg);
  border-radius: var(--cb-radius-sm);
  color: var(--cb-text-tertiary);
}

.session-time {
  color: var(--cb-text-tertiary);
}

.session-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-text {
  font-size: 12px;
  color: var(--cb-text-secondary);
}

.empty-sessions, .empty-history {
  text-align: center;
  padding: 32px;
  color: var(--cb-text-tertiary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon {
  font-size: 32px;
}

/* 接管历史 */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
}

.history-icon {
  font-size: 20px;
}

.history-content {
  flex: 1;
}

.history-title {
  font-weight: 500;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.history-meta {
  font-size: 12px;
  color: var(--cb-text-tertiary);
  display: flex;
  gap: 8px;
}

.history-action {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: var(--cb-radius-sm);
}

.history-action.taken_over {
  background: rgba(239, 68, 68, 0.1);
  color: var(--cb-danger);
}

.history-action.blocked {
  background: rgba(245, 158, 11, 0.1);
  color: var(--cb-warning);
}

.history-action.recovered {
  background: rgba(34, 197, 94, 0.1);
  color: var(--cb-success);
}

.btn-secondary {
  padding: 8px 16px;
  background: var(--cb-bg-sunken);
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  color: var(--cb-text-secondary);
  cursor: pointer;
  font-size: var(--cb-text-sm);
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--cb-border);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>