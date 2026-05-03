<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('sentinel.title') }}</h1>
        <p class="cb-page-desc">保护你的对话安全</p>
      </div>
    </div>

    <!-- 状态卡片 -->
    <div class="status-section cb-card">
      <div class="status-header">
        <span class="status-dot" :class="isHealthy ? 'healthy' : 'warning'"></span>
        <span class="status-text">{{ isHealthy ? '运行正常' : '需要关注' }}</span>
      </div>
      <p class="status-desc">安全守护正在后台运行，自动过滤敏感信息</p>
    </div>

    <!-- 今日统计 -->
    <div class="stats-section cb-card">
      <h3>今日统计</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">{{ stats.totalMessages }}</span>
          <span class="stat-label">消息总数</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.filtered }}</span>
          <span class="stat-label">已过滤</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.blocked }}</span>
          <span class="stat-label">已拦截</span>
        </div>
      </div>
    </div>

    <!-- 安全日志 -->
    <div class="logs-section cb-card">
      <div class="section-header">
        <h3>安全日志</h3>
        <button class="view-all" @click="viewAllLogs">查看全部</button>
      </div>
      <div class="logs-list">
        <div v-for="log in recentLogs" :key="log.id" class="log-item">
          <span class="log-icon">{{ log.type === 'filter' ? '🔒' : '🛡️' }}</span>
          <div class="log-content">
            <span class="log-message">{{ log.message }}</span>
            <span class="log-time">{{ log.time }}</span>
          </div>
        </div>
        <div v-if="recentLogs.length === 0" class="empty-logs">
          <span>✅ 今日无安全事件</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const isHealthy = ref(true)

const stats = ref({
  totalMessages: 45,
  filtered: 3,
  blocked: 0
})

const recentLogs = ref([
  { id: '1', type: 'filter', message: '已过滤敏感信息', time: '10:23' },
  { id: '2', type: 'filter', message: '已过滤敏感信息', time: '09:15' },
])

function viewAllLogs() {
  // TODO: 跳转到完整日志页面
}
</script>

<style scoped>
.status-section {
  padding: 24px;
  margin-bottom: 16px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--cb-success);
}

.status-dot.warning {
  background: var(--cb-warning);
}

.status-text {
  font-size: var(--cb-text-lg);
  font-weight: 600;
  color: var(--cb-text-primary);
}

.status-desc {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.stats-section {
  padding: 20px;
  margin-bottom: 16px;
}

.stats-section h3 {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-item {
  text-align: center;
  padding: 16px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
}

.stat-value {
  display: block;
  font-size: var(--cb-text-2xl);
  font-weight: 700;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.stat-label {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.logs-section {
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
}

.view-all {
  font-size: var(--cb-text-sm);
  color: var(--cb-primary);
  background: none;
  border: none;
  cursor: pointer;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
}

.log-icon {
  font-size: 18px;
}

.log-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log-message {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-primary);
}

.log-time {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}

.empty-logs {
  text-align: center;
  padding: 24px;
  color: var(--cb-text-tertiary);
}
</style>
