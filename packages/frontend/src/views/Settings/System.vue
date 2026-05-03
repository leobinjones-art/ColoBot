<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">系统状态</h1>
        <p class="cb-page-desc">查看应用运行状态</p>
      </div>
    </div>

    <!-- 系统状态 -->
    <div class="status-section cb-card">
      <h3>运行状态</h3>
      <div class="status-grid">
        <div class="status-item">
          <span class="status-label">AI 服务</span>
          <span class="status-value" :class="systemStatus.server">
            {{ systemStatus.server === 'running' ? '正常' : '异常' }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">版本</span>
          <span class="status-value">{{ systemStatus.version }}</span>
        </div>
      </div>
    </div>

    <!-- 数据管理 -->
    <div class="data-section cb-card">
      <h3>数据管理</h3>
      <div class="data-actions">
        <button class="action-btn" @click="exportData">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          导出我的数据
        </button>
        <button class="action-btn danger" @click="clearCache">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          清理缓存
        </button>
      </div>
      <p class="data-hint">所有数据仅存储在你的设备上，不会上传到云端</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { configApi } from '@/api'

const systemStatus = ref({
  server: 'running',
  version: '0.2.1'
})

async function fetchSystemStatus() {
  try {
    const res: any = await configApi.status()
    systemStatus.value = res.data || systemStatus.value
  } catch (e) {
    console.error('Failed to fetch system status', e)
  }
}

async function exportData() {
  try {
    const res: any = await configApi.export()
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `colobot-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败')
  }
}

async function clearCache() {
  if (!confirm('确定要清理缓存吗？这不会删除你的对话记录和个人数据。')) return
  try {
    await configApi.clearCache()
    alert('缓存已清理')
  } catch (e) {
    alert('清理失败')
  }
}

onMounted(() => {
  fetchSystemStatus()
})
</script>

<style scoped>
.status-section,
.data-section {
  padding: 20px;
  margin-bottom: 16px;
}

.status-section h3,
.data-section h3 {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
}

.status-label {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.status-value {
  font-size: var(--cb-text-sm);
  font-weight: 500;
}

.status-value.running {
  color: var(--cb-success);
}

.status-value.stopped {
  color: var(--cb-danger);
}

.data-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--cb-bg-sunken);
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  color: var(--cb-text-primary);
  font-size: var(--cb-text-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--cb-border);
}

.action-btn.danger {
  color: var(--cb-danger);
  border-color: var(--cb-danger);
}

.action-btn.danger:hover {
  background: var(--cb-danger);
  color: white;
}

.data-hint {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}
</style>