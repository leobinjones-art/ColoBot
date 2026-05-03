<template>
  <div class="settings-page">
    <div class="settings-header">
      <h1>{{ t('nav.settings') }}</h1>
    </div>

    <div class="settings-content">
      <!-- AI 行为 -->
      <div class="settings-section">
        <div class="section-header" @click="toggleSection('behavior')">
          <h2>{{ t('settings.behavior') }}</h2>
          <svg class="expand-icon" :class="{ rotated: expandedSections.behavior }" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
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
          <svg class="expand-icon" :class="{ rotated: expandedSections.mentalHealth }" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
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
            <input type="number" v-model.number="mentalHealth.triggerDays" min="1" max="30" class="number-input" />
            <span>{{ t('mentalHealth.days') }}</span>
            <span>{{ t('mentalHealth.threshold') }}</span>
            <input type="number" v-model.number="mentalHealth.threshold" min="1" max="10" class="number-input" />
            <span>{{ t('mentalHealth.score') }}</span>
          </div>
        </div>
      </div>

      <!-- 安全与隐私 -->
      <div class="settings-section">
        <div class="section-header" @click="toggleSection('privacy')">
          <h2>{{ t('settings.privacy') }}</h2>
          <svg class="expand-icon" :class="{ rotated: expandedSections.privacy }" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
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
            <button class="action-btn" @click="showSecurityLog = true">
              {{ t('privacy.viewSecurityLog') }}
            </button>
            <button class="action-btn" @click="showDataPanel = true">
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
          <svg class="expand-icon" :class="{ rotated: expandedSections.advanced }" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <div v-if="expandedSections.advanced" class="section-content">
          <div class="setting-item">
            <label>API Key</label>
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
            <div class="log-item">
              <span class="log-time">10:23</span>
              <span class="log-status success">✓</span>
              <span>{{ t('securityLog.inputAudit') }} {{ t('securityLog.allPassed') }}</span>
            </div>
            <div class="log-item">
              <span class="log-time">10:24</span>
              <span class="log-status success">✓</span>
              <span>{{ t('securityLog.outputAudit') }} {{ t('securityLog.allPassed') }}</span>
            </div>
          </div>
          <div class="log-section">
            <h4>{{ t('securityLog.thisWeek') }}</h4>
            <div class="log-stats">
              <div class="stat-item">
                <span>{{ t('securityLog.inputAudit') }}: 45 次，{{ t('securityLog.allPassed') }}</span>
              </div>
              <div class="stat-item">
                <span>{{ t('securityLog.outputAudit') }}: 45 次，0 {{ t('securityLog.intercepted') }}</span>
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
            <div class="memory-list">
              <div class="memory-item">• 你说你是程序员，主要用 TypeScript</div>
              <div class="memory-item">• 你提到最近在做一个叫 ColoBot 的项目</div>
              <div class="memory-item">• 你说每天大概 11 点睡觉</div>
            </div>
            <div class="section-actions">
              <button class="action-btn small">{{ t('data.viewAll') }}</button>
              <button class="action-btn small secondary">{{ t('common.edit') }}</button>
              <button class="action-btn small danger">{{ t('common.delete') }}</button>
            </div>
          </div>
          <div class="data-section">
            <h4>{{ t('data.moodRecords') }}</h4>
            <div class="mood-summary">
              <span>最近 7 天平均: 7.2/10</span>
              <span>趋势: 稳定</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

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

function toggleSection(section: keyof typeof expandedSections) {
  expandedSections[section] = !expandedSections[section]
}

function exportData() {
  // TODO: 实现数据导出
  alert('数据导出功能开发中...')
}

function confirmClearData() {
  if (confirm('确定要清除所有数据吗？此操作不可恢复。')) {
    // TODO: 实现数据清除
    alert('数据清除功能开发中...')
  }
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
}

.settings-header h1 {
  font-size: var(--cb-text-2xl);
  font-weight: 600;
  color: var(--cb-text-primary);
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
