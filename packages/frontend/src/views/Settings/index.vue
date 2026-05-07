<template>
  <div class="settings-page">
    <div class="settings-header">
      <h1>{{ t('nav.settings') }}</h1>
      <span v-if="saving" class="saving-indicator">{{ t('common.saving') }}</span>
    </div>

    <div class="settings-content">
      <!-- AI 行为 -->
      <div class="settings-section">
        <div class="section-header" @click="toggleSection('behavior')">
          <h2>{{ t('settings.behavior') }}</h2>
          <svg
            class="expand-icon"
            :class="{ rotated: expandedSections.behavior }"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-if="expandedSections.behavior" class="section-content">
          <!-- 说话风格 -->
          <div class="setting-item">
            <label>{{ t('behavior.style') }}</label>
            <div class="radio-group">
              <label class="radio-item">
                <input type="radio" v-model="behavior.style" value="concise" />
                <span>{{ t('behavior.styleConcise') }}</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="behavior.style" value="normal" />
                <span>{{ t('behavior.styleNormal') }}</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="behavior.style" value="detailed" />
                <span>{{ t('behavior.styleDetailed') }}</span>
              </label>
            </div>
          </div>

          <!-- 主动性 -->
          <div class="setting-item">
            <label>{{ t('behavior.proactivity') }}</label>
            <div class="radio-group">
              <label class="radio-item">
                <input type="radio" v-model="behavior.proactivity" value="passive" />
                <span>{{ t('behavior.proactivityPassive') }}</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="behavior.proactivity" value="greet" />
                <span>{{ t('behavior.proactivityGreet') }}</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="behavior.proactivity" value="care" />
                <span>{{ t('behavior.proactivityCare') }}</span>
              </label>
            </div>
          </div>

          <!-- 记忆范围 -->
          <div class="setting-item">
            <label>{{ t('behavior.memory') }}</label>
            <div class="radio-group">
              <label class="radio-item">
                <input type="radio" v-model="behavior.memory" value="session" />
                <span>{{ t('behavior.memorySession') }}</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="behavior.memory" value="important" />
                <span>{{ t('behavior.memoryImportant') }}</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="behavior.memory" value="all" />
                <span>{{ t('behavior.memoryAll') }}</span>
              </label>
            </div>
          </div>

          <!-- 数据可见性 -->
          <div class="setting-item">
            <label>{{ t('behavior.dataVisibility') }}</label>
            <div class="checkbox-group">
              <label class="checkbox-item">
                <input type="checkbox" v-model="behavior.canSeeMood" />
                <span>{{ t('behavior.canSeeMood') }}</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" v-model="behavior.canSeeFinance" />
                <span>{{ t('behavior.canSeeFinance') }}</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" v-model="behavior.canSeeHealth" />
                <span>{{ t('behavior.canSeeHealth') }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- 心理健康守护 -->
      <div class="settings-section">
        <div class="section-header" @click="toggleSection('mentalHealth')">
          <h2>{{ t('settings.mentalHealth') }}</h2>
          <svg
            class="expand-icon"
            :class="{ rotated: expandedSections.mentalHealth }"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-if="expandedSections.mentalHealth" class="section-content">
          <div class="setting-item">
            <label class="checkbox-item">
              <input type="checkbox" v-model="mentalHealth.watchMood" />
              <span>{{ t('mentalHealth.watchMood') }}</span>
            </label>
          </div>
          <div class="setting-item">
            <label class="checkbox-item">
              <input type="checkbox" v-model="mentalHealth.proactiveCare" />
              <span>{{ t('mentalHealth.proactiveCare') }}</span>
            </label>
          </div>
          <div class="setting-item">
            <label class="checkbox-item">
              <input type="checkbox" v-model="mentalHealth.suggestContact" />
              <span>{{ t('mentalHealth.suggestContact') }}</span>
            </label>
          </div>
          <div class="setting-item inline">
            <span>{{ t('mentalHealth.triggerDays') }}</span>
            <input
              type="number"
              v-model.number="mentalHealth.triggerDays"
              min="1"
              max="30"
              class="number-input"
            />
            <span>{{ t('mentalHealth.days') }}</span>
            <span>{{ t('mentalHealth.threshold') }}</span>
            <input
              type="number"
              v-model.number="mentalHealth.threshold"
              min="1"
              max="10"
              class="number-input"
            />
            <span>{{ t('mentalHealth.score') }}</span>
          </div>
        </div>
      </div>

      <!-- 安全与隐私 -->
      <div class="settings-section">
        <div class="section-header" @click="toggleSection('privacy')">
          <h2>{{ t('settings.privacy') }}</h2>
          <svg
            class="expand-icon"
            :class="{ rotated: expandedSections.privacy }"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-if="expandedSections.privacy" class="section-content">
          <!-- 安全模式 -->
          <div class="setting-item">
            <label>{{ t('privacy.safetyMode') }}</label>
            <div class="radio-group">
              <label class="radio-item">
                <input type="radio" v-model="privacy.safetyMode" value="conservative" />
                <span>{{ t('privacy.modeConservative') }}</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="privacy.safetyMode" value="normal" />
                <span>{{ t('privacy.modeNormal') }}</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="privacy.safetyMode" value="relaxed" />
                <span>{{ t('privacy.modeRelaxed') }}</span>
              </label>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="setting-item actions">
            <button class="action-btn" @click="openSecurityLog">
              {{ t('privacy.viewSecurityLog') }}
            </button>
            <button class="action-btn" @click="openDataPanel">
              {{ t('privacy.viewMyData') }}
            </button>
          </div>
          <div class="setting-item actions">
            <button class="action-btn secondary" @click="exportData">
              {{ t('privacy.exportData') }}
            </button>
            <button class="action-btn danger" @click="confirmClearData">
              {{ t('privacy.clearData') }}
            </button>
          </div>

          <!-- 数据存储位置 -->
          <div class="setting-item">
            <label>{{ t('privacy.dataLocation') }}</label>
            <div class="data-location">
              <div class="location-item">
                <span class="status-dot success"></span>
                <span>{{ t('data.conversationHistory') }}: {{ t('data.localOnly') }}</span>
              </div>
              <div class="location-item">
                <span class="status-dot success"></span>
                <span>{{ t('data.personalData') }}: {{ t('data.localOnly') }}</span>
              </div>
              <div class="location-item">
                <span class="status-dot success"></span>
                <span>{{ t('data.apiKey') }}: {{ t('data.localOnly') }}</span>
              </div>
              <div class="location-item">
                <span class="status-dot"></span>
                <span>{{ t('privacy.cloudSync') }}: {{ t('data.cloudSyncOff') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 高级设置 -->
      <div class="settings-section">
        <div class="section-header" @click="toggleSection('advanced')">
          <h2>{{ t('nav.advanced') }}</h2>
          <svg
            class="expand-icon"
            :class="{ rotated: expandedSections.advanced }"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-if="expandedSections.advanced" class="section-content">
          <div class="setting-item">
            <label>密钥</label>
            <div class="api-key-status">
              <span class="status-dot success"></span>
              <span>{{ t('common.enabled') }}</span>
              <button class="action-btn small" @click="showApiKeyModal = true">更换</button>
            </div>
          </div>
          <div class="setting-item">
            <router-link to="/agents" class="link-btn">{{ t('nav.agents') }}</router-link>
            <router-link to="/skills" class="link-btn">{{ t('nav.skills') }}</router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- 安全日志弹窗 -->
    <div v-if="showSecurityLog" class="modal-overlay" @click="showSecurityLog = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ t('securityLog.title') }}</h3>
          <button class="close-btn" @click="showSecurityLog = false">×</button>
        </div>
        <div class="modal-body">
          <div class="log-section">
            <h4>{{ t('securityLog.today') }}</h4>
            <div v-if="securityLogs.length === 0" class="empty-log">暂无日志记录</div>
            <div v-for="log in securityLogs" :key="log.id" class="log-item">
              <span class="log-time">{{ log.time }}</span>
              <span class="log-status" :class="log.status">{{
                log.status === 'passed' ? '✓' : '⚠'
              }}</span>
              <span>{{ log.message }}</span>
            </div>
          </div>
          <div v-if="securityStats" class="log-section">
            <h4>{{ t('securityLog.thisWeek') }}</h4>
            <div class="log-stats">
              <div class="stat-item">
                <span
                  >{{ t('securityLog.inputAudit') }}: {{ securityStats.inputTotal }} 次，{{
                    securityStats.inputPassed === securityStats.inputTotal
                      ? t('securityLog.allPassed')
                      : `${securityStats.inputTotal - securityStats.inputPassed} ${t('securityLog.intercepted')}`
                  }}</span
                >
              </div>
              <div class="stat-item">
                <span
                  >{{ t('securityLog.outputAudit') }}: {{ securityStats.outputTotal }} 次，{{
                    securityStats.outputIntercepted
                  }}
                  {{ t('securityLog.intercepted') }}</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据面板弹窗 -->
    <div v-if="showDataPanel" class="modal-overlay" @click="showDataPanel = false">
      <div class="modal-content large" @click.stop>
        <div class="modal-header">
          <h3>{{ t('data.title') }}</h3>
          <button class="close-btn" @click="showDataPanel = false">×</button>
        </div>
        <div class="modal-body">
          <div class="data-section">
            <h4>{{ t('data.memories') }}</h4>
            <div v-if="memories.length === 0" class="empty-data">AI 还没有记住任何关于你的事</div>
            <div v-else class="memory-list">
              <div v-for="memory in memories" :key="memory.id" class="memory-item">
                • {{ memory.content }}
              </div>
            </div>
            <div v-if="memories.length > 0" class="section-actions">
              <button class="action-btn small">{{ t('data.viewAll') }}</button>
              <button class="action-btn small danger">{{ t('common.delete') }}</button>
            </div>
          </div>
          <div class="data-section">
            <h4>{{ t('data.storageLocation') }}</h4>
            <div class="data-location">
              <div class="location-item">
                <span class="status-dot success"></span>
                <span>{{ t('data.conversationHistory') }}: {{ t('data.localOnly') }}</span>
              </div>
              <div class="location-item">
                <span class="status-dot success"></span>
                <span>{{ t('data.personalData') }}: {{ t('data.localOnly') }}</span>
              </div>
              <div class="location-item">
                <span class="status-dot success"></span>
                <span>{{ t('data.apiKey') }}: {{ t('data.localOnly') }}</span>
              </div>
              <div class="location-item">
                <span class="status-dot"></span>
                <span>{{ t('privacy.cloudSync') }}: {{ t('data.cloudSyncOff') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { behaviorApi, securityLogApi, userProfileApi } from '@/api'

const { t } = useI18n()

const expandedSections = reactive({
  behavior: true,
  mentalHealth: true,
  privacy: true,
  advanced: false,
})

const behavior = reactive({
  style: 'normal',
  proactivity: 'greet',
  memory: 'important',
  canSeeMood: true,
  canSeeFinance: false,
  canSeeHealth: false,
})

const mentalHealth = reactive({
  watchMood: true,
  proactiveCare: true,
  suggestContact: false,
  triggerDays: 7,
  threshold: 4,
})

const privacy = reactive({
  safetyMode: 'normal',
})

const showSecurityLog = ref(false)
const showDataPanel = ref(false)
const showApiKeyModal = ref(false)
const saving = ref(false)

const securityLogs = ref<any[]>([])
const securityStats = ref<any>(null)
const memories = ref<any[]>([])

// Auto-save with debounce
let saveTimeout: ReturnType<typeof setTimeout> | null = null

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    saving.value = true
    await saveBehavior()
    saving.value = false
  }, 500)
}

// Watch for changes
watch(() => ({ ...behavior }), scheduleSave, { deep: true })
watch(() => ({ ...mentalHealth }), scheduleSave, { deep: true })
watch(() => privacy.safetyMode, scheduleSave)

onMounted(async () => {
  try {
    // 加载行为设置
    const behaviorRes: any = await behaviorApi.get()
    if (behaviorRes.data) {
      Object.assign(behavior, behaviorRes.data)
      if (behaviorRes.data.mentalHealth) {
        Object.assign(mentalHealth, behaviorRes.data.mentalHealth)
      }
      privacy.safetyMode = behaviorRes.data.safetyMode || 'normal'
    }
  } catch (e) {
    console.error('Failed to load behavior settings', e)
  }
})

async function loadSecurityLogs() {
  try {
    const [logsRes, statsRes]: any[] = await Promise.all([
      securityLogApi.list(),
      securityLogApi.stats(),
    ])
    securityLogs.value = logsRes.data || []
    securityStats.value = statsRes.data
  } catch (e) {
    console.error('Failed to load security logs', e)
  }
}

async function loadMemories() {
  try {
    const res: any = await userProfileApi.memories()
    memories.value = res.data || []
  } catch (e) {
    console.error('Failed to load memories', e)
  }
}

function toggleSection(section: keyof typeof expandedSections) {
  expandedSections[section] = !expandedSections[section]
}

async function saveBehavior() {
  try {
    await behaviorApi.update({
      ...behavior,
      mentalHealth,
      safetyMode: privacy.safetyMode,
    })
  } catch (e) {
    console.error('Failed to save behavior', e)
  }
}

async function exportData() {
  try {
    const res: any = await userProfileApi.exportData()
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `colobot-data-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Failed to export data', e)
    alert('导出失败')
  }
}

async function confirmClearData() {
  if (confirm('确定要清除所有数据吗？此操作不可恢复。')) {
    try {
      await userProfileApi.clearData()
      alert('数据已清除')
    } catch (e) {
      console.error('Failed to clear data', e)
      alert('清除失败')
    }
  }
}

// 当打开安全日志时加载数据
function openSecurityLog() {
  showSecurityLog.value = true
  loadSecurityLogs()
}

// 当打开数据面板时加载数据
function openDataPanel() {
  showDataPanel.value = true
  loadMemories()
}
</script>

<style scoped>
.settings-page {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.settings-header {
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-header h1 {
  font-size: var(--cb-text-2xl);
  font-weight: 600;
  color: var(--cb-text-primary);
}

.saving-indicator {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-tertiary);
}

.settings-section {
  background: var(--cb-bg-elevated);
  border: 1px solid var(--cb-border-light);
  border-radius: var(--cb-radius-lg);
  margin-bottom: 16px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.section-header:hover {
  background: var(--cb-bg-sunken);
}

.section-header h2 {
  font-size: var(--cb-text-lg);
  font-weight: 500;
  color: var(--cb-text-primary);
}

.expand-icon {
  color: var(--cb-text-tertiary);
  transition: transform 0.2s ease;
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

.section-content {
  padding: 0 20px 20px;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--cb-text-primary);
}

.radio-group,
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio-item,
.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--cb-text-secondary);
}

.radio-item input,
.checkbox-item input {
  accent-color: var(--cb-primary);
}

.setting-item.inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.number-input {
  width: 60px;
  padding: 6px 8px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  text-align: center;
}

.setting-item.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 8px 16px;
  background: var(--cb-primary);
  color: white;
  border: none;
  border-radius: var(--cb-radius-md);
  font-size: var(--cb-text-sm);
  cursor: pointer;
  transition: background 0.15s ease;
}

.action-btn:hover {
  background: var(--cb-primary-hover);
}

.action-btn.secondary {
  background: var(--cb-bg-sunken);
  color: var(--cb-text-primary);
}

.action-btn.secondary:hover {
  background: var(--cb-border);
}

.action-btn.danger {
  background: var(--cb-danger);
}

.action-btn.danger:hover {
  opacity: 0.9;
}

.action-btn.small {
  padding: 4px 12px;
  font-size: var(--cb-text-xs);
}

.data-location {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.location-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cb-text-tertiary);
}

.status-dot.success {
  background: var(--cb-success);
}

.api-key-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.link-btn {
  padding: 8px 16px;
  background: var(--cb-bg-sunken);
  color: var(--cb-text-primary);
  border-radius: var(--cb-radius-md);
  text-decoration: none;
  font-size: var(--cb-text-sm);
  transition: background 0.15s ease;
}

.link-btn:hover {
  background: var(--cb-border);
}

/* Modal */
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
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-content.large {
  max-width: 700px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--cb-border-light);
}

.modal-header h3 {
  font-size: var(--cb-text-lg);
  font-weight: 500;
  color: var(--cb-text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--cb-text-tertiary);
  cursor: pointer;
}

.close-btn:hover {
  color: var(--cb-text-primary);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.log-section,
.data-section {
  margin-bottom: 20px;
}

.log-section:last-child,
.data-section:last-child {
  margin-bottom: 0;
}

.log-section h4,
.data-section h4 {
  font-size: var(--cb-text-sm);
  font-weight: 500;
  color: var(--cb-text-secondary);
  margin-bottom: 12px;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: var(--cb-text-sm);
  color: var(--cb-text-primary);
}

.log-time {
  color: var(--cb-text-tertiary);
  min-width: 50px;
}

.log-status {
  font-weight: 500;
}

.log-status.success {
  color: var(--cb-success);
}

.log-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.memory-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.memory-item {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
  padding: 8px 12px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
}

.section-actions {
  display: flex;
  gap: 8px;
}

.mood-summary {
  display: flex;
  gap: 24px;
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}
</style>
