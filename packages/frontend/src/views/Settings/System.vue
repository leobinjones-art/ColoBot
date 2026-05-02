<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('settings.system') }}</h1>
        <p class="cb-page-desc">系统配置与状态监控</p>
      </div>
    </div>

    <!-- 系统状态 -->
    <div class="status-section cb-card">
      <h3>系统状态</h3>
      <div class="status-grid">
        <div class="status-item">
          <span class="status-label">服务状态</span>
          <span class="status-value" :class="systemStatus.server">
            {{ systemStatus.server === 'running' ? '运行中' : '已停止' }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">数据库</span>
          <span class="status-value" :class="systemStatus.database">
            {{ systemStatus.database === 'connected' ? '已连接' : '未连接' }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">向量存储</span>
          <span class="status-value" :class="systemStatus.vectorStore">
            {{ systemStatus.vectorStore === 'ready' ? '就绪' : '未就绪' }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">版本</span>
          <span class="status-value">{{ systemStatus.version }}</span>
        </div>
      </div>
    </div>

    <!-- 存储配置 -->
    <div class="storage-section cb-card">
      <h3>存储配置</h3>
      <div class="form-group">
        <label>数据目录</label>
        <input v-model="storageConfig.dataDir" placeholder="~/.colobot/data" />
      </div>
      <div class="form-group">
        <label>日志目录</label>
        <input v-model="storageConfig.logDir" placeholder="~/.colobot/logs" />
      </div>
      <div class="form-group">
        <label>缓存目录</label>
        <input v-model="storageConfig.cacheDir" placeholder="~/.colobot/cache" />
      </div>
      <button class="btn-primary" @click="saveStorageConfig">保存配置</button>
    </div>

    <!-- 日志级别 -->
    <div class="logging-section cb-card">
      <h3>日志配置</h3>
      <div class="form-group">
        <label>日志级别</label>
        <select v-model="loggingConfig.level">
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
      </div>
      <div class="form-group">
        <label>日志输出</label>
        <div class="checkbox-group">
          <label class="checkbox-item">
            <input type="checkbox" v-model="loggingConfig.console" />
            <span>控制台</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" v-model="loggingConfig.file" />
            <span>文件</span>
          </label>
        </div>
      </div>
      <button class="btn-primary" @click="saveLoggingConfig">保存配置</button>
    </div>

    <!-- 功能开关 -->
    <div class="features-section cb-card">
      <h3>功能开关</h3>
      <div class="feature-list">
        <div class="feature-item">
          <div class="feature-info">
            <span class="feature-name">自动记忆</span>
            <span class="feature-desc">自动保存对话内容到记忆库</span>
          </div>
          <input type="checkbox" v-model="features.autoMemory" class="toggle" />
        </div>
        <div class="feature-item">
          <div class="feature-info">
            <span class="feature-name">意图识别</span>
            <span class="feature-desc">自动识别用户意图并执行动作</span>
          </div>
          <input type="checkbox" v-model="features.intentRecognition" class="toggle" />
        </div>
        <div class="feature-item">
          <div class="feature-info">
            <span class="feature-name">流式输出</span>
            <span class="feature-desc">启用 SSE 流式响应</span>
          </div>
          <input type="checkbox" v-model="features.streaming" class="toggle" />
        </div>
        <div class="feature-item">
          <div class="feature-info">
            <span class="feature-name">调试模式</span>
            <span class="feature-desc">显示详细调试信息</span>
          </div>
          <input type="checkbox" v-model="features.debugMode" class="toggle" />
        </div>
      </div>
      <button class="btn-primary" @click="saveFeatures">保存配置</button>
    </div>

    <!-- 危险操作 -->
    <div class="danger-section cb-card">
      <h3>危险操作</h3>
      <div class="danger-actions">
        <button class="btn-danger" @click="clearCache">清理缓存</button>
        <button class="btn-danger" @click="resetConfig">重置配置</button>
        <button class="btn-danger" @click="exportData">导出数据</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { configApi } from '@/api'

const { t } = useI18n()

const systemStatus = ref({
  server: 'running',
  database: 'connected',
  vectorStore: 'ready',
  version: '0.2.1'
})

const storageConfig = ref({
  dataDir: '',
  logDir: '',
  cacheDir: ''
})

const loggingConfig = ref({
  level: 'info',
  console: true,
  file: true
})

const features = ref({
  autoMemory: true,
  intentRecognition: true,
  streaming: true,
  debugMode: false
})

async function fetchSystemStatus() {
  try {
    const res: any = await configApi.status()
    systemStatus.value = res.data || systemStatus.value
  } catch (e) {
    console.error('Failed to fetch system status', e)
  }
}

async function fetchConfig() {
  try {
    const res: any = await configApi.get()
    const config = res.data || {}
    storageConfig.value = config.storage || storageConfig.value
    loggingConfig.value = config.logging || loggingConfig.value
    features.value = config.features || features.value
  } catch (e) {
    console.error('Failed to fetch config', e)
  }
}

async function saveStorageConfig() {
  try {
    await configApi.update({ storage: storageConfig.value })
    alert('存储配置已保存')
  } catch (e) {
    alert('保存失败')
  }
}

async function saveLoggingConfig() {
  try {
    await configApi.update({ logging: loggingConfig.value })
    alert('日志配置已保存')
  } catch (e) {
    alert('保存失败')
  }
}

async function saveFeatures() {
  try {
    await configApi.update({ features: features.value })
    alert('功能配置已保存')
  } catch (e) {
    alert('保存失败')
  }
}

async function clearCache() {
  if (!confirm('确定要清理缓存吗？')) return
  try {
    await configApi.clearCache()
    alert('缓存已清理')
  } catch (e) {
    alert('清理失败')
  }
}

async function resetConfig() {
  if (!confirm('确定要重置所有配置吗？此操作不可恢复！')) return
  try {
    await configApi.reset()
    await fetchConfig()
    alert('配置已重置')
  } catch (e) {
    alert('重置失败')
  }
}

async function exportData() {
  try {
    const res: any = await configApi.export()
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `colobot-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败')
  }
}

onMounted(() => {
  fetchSystemStatus()
  fetchConfig()
})
</script>

<style scoped>
.status-section,
.storage-section,
.logging-section,
.features-section,
.danger-section {
  padding: 20px;
  margin-bottom: 16px;
}

.status-section h3,
.storage-section h3,
.logging-section h3,
.features-section h3,
.danger-section h3 {
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

.status-value.running,
.status-value.connected,
.status-value.ready {
  color: var(--cb-success);
}

.status-value.stopped,
.status-value.disconnected,
.status-value.not_ready {
  color: var(--cb-danger);
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
.form-group select:focus {
  outline: none;
  border-color: var(--cb-primary);
}

.checkbox-group {
  display: flex;
  gap: 16px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-item input {
  width: 16px;
  height: 16px;
}

.checkbox-item span {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.feature-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
}

.feature-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feature-name {
  font-size: var(--cb-text-sm);
  font-weight: 500;
  color: var(--cb-text-primary);
}

.feature-desc {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}

.toggle {
  width: 40px;
  height: 20px;
  appearance: none;
  background: var(--cb-bg);
  border-radius: var(--cb-radius-full);
  cursor: pointer;
  position: relative;
  transition: background 0.15s ease;
}

.toggle:checked {
  background: var(--cb-primary);
}

.toggle::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform 0.15s ease;
}

.toggle:checked::before {
  transform: translateX(20px);
}

.danger-actions {
  display: flex;
  gap: 12px;
}

.btn-danger {
  padding: 10px 16px;
  background: transparent;
  border: 1px solid var(--cb-danger);
  border-radius: var(--cb-radius-md);
  color: var(--cb-danger);
  font-size: var(--cb-text-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-danger:hover {
  background: var(--cb-danger);
  color: white;
}
</style>