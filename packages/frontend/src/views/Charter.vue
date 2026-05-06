<template>
  <div class="charter-page">
    <div class="charter-header">
      <h1>{{ t('charter.title') }}</h1>
      <p class="subtitle">{{ t('charter.subtitle') }}</p>
    </div>

    <!-- 活跃许可证 -->
    <div class="section">
      <h2>{{ t('charter.activeCharters') }}</h2>
      <div v-if="activeCharters.length === 0" class="empty-state">
        <p>{{ t('charter.noActiveCharters') }}</p>
      </div>
      <div v-else class="charter-list">
        <div v-for="charter in activeCharters" :key="charter.id" class="charter-card active">
          <div class="charter-info">
            <div class="charter-icon">{{ getCharterIcon(charter.type) }}</div>
            <div class="charter-details">
              <h3>{{ getCharterName(charter.type) }}</h3>
              <p class="charter-desc">{{ getCharterDesc(charter.type) }}</p>
              <div class="charter-meta">
                <span class="expires" v-if="charter.expiresAt">
                  {{ t('charter.expires') }}: {{ formatTime(charter.expiresAt) }}
                </span>
                <span class="capabilities">
                  {{ t('charter.capabilities') }}: {{ charter.capabilities?.join(', ') || '-' }}
                </span>
              </div>
            </div>
          </div>
          <button class="btn-revoke" @click="revokeCharter(charter.id)">
            {{ t('charter.revoke') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 可申请许可证 -->
    <div class="section">
      <h2>{{ t('charter.availableCharters') }}</h2>
      <div class="charter-list">
        <div v-for="charter in availableCharters" :key="charter.type" class="charter-card">
          <div class="charter-info">
            <div class="charter-icon">{{ charter.icon }}</div>
            <div class="charter-details">
              <h3>{{ charter.name }}</h3>
              <p class="charter-desc">{{ charter.description }}</p>
              <div class="charter-capabilities">
                <span v-for="cap in charter.capabilities" :key="cap.name" class="capability-tag">
                  {{ cap.name }}
                </span>
              </div>
            </div>
          </div>
          <button class="btn-apply" @click="showApplyModal(charter)">
            {{ t('charter.apply') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 申请弹窗 -->
    <div v-if="applyModalVisible" class="modal-overlay" @click="closeApplyModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ t('charter.applyFor') }} {{ selectedCharter?.name }}</h3>
          <button class="close-btn" @click="closeApplyModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label>{{ t('charter.reason') }}</label>
            <textarea v-model="applyReason" :placeholder="t('charter.reasonPlaceholder')" rows="3"></textarea>
          </div>
          <div class="disclaimer" v-if="selectedCharter?.disclaimer">
            <p>{{ selectedCharter.disclaimer }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn secondary" @click="closeApplyModal">{{ t('common.cancel') }}</button>
          <button class="btn primary" @click="submitApply" :disabled="!applyReason.trim()">
            {{ t('charter.submit') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { charterApi } from '@/api'

const { t } = useI18n()

interface Charter {
  id: string
  charterId: string
  type: string
  status: string
  expiresAt?: number
  capabilities?: string[]
}

interface CharterDefinition {
  type: string
  name: string
  description: string
  icon: string
  capabilities: { name: string; description: string }[]
  disclaimer?: string
}

const activeCharters = ref<Charter[]>([])
const availableCharters = ref<CharterDefinition[]>([])
const applyModalVisible = ref(false)
const selectedCharter = ref<CharterDefinition | null>(null)
const applyReason = ref('')
const loading = ref(false)

const getCharterIcon = (type: string) => {
  const icons: Record<string, string> = {
    academic: '📚',
    legal: '⚖️',
    longdoc: '📄',
  }
  return icons[type] || '📜'
}

const getCharterName = (type: string) => {
  const names: Record<string, string> = {
    academic: '学术写作许可证',
    legal: '法律文档许可证',
    longdoc: '长文档许可证',
  }
  return names[type] || type
}

const getCharterDesc = (type: string) => {
  const descs: Record<string, string> = {
    academic: '论文写作、文献综述、引用格式化',
    legal: '合同起草、免责声明、法律分析',
    longdoc: '长文档处理、分区处理、目录生成',
  }
  return descs[type] || ''
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

const showApplyModal = (charter: CharterDefinition) => {
  selectedCharter.value = charter
  applyReason.value = ''
  applyModalVisible.value = true
}

const closeApplyModal = () => {
  applyModalVisible.value = false
  selectedCharter.value = null
}

const submitApply = async () => {
  if (!selectedCharter.value || !applyReason.value.trim()) return

  loading.value = true
  try {
    await charterApi.apply({
      type: selectedCharter.value.type,
      reason: applyReason.value.trim(),
    })
    closeApplyModal()
    await fetchActiveCharters()
  } catch (error) {
    console.error('Failed to apply charter:', error)
  } finally {
    loading.value = false
  }
}

const revokeCharter = async (instanceId: string) => {
  try {
    await charterApi.revoke(instanceId)
    await fetchActiveCharters()
  } catch (error) {
    console.error('Failed to revoke charter:', error)
  }
}

const fetchActiveCharters = async () => {
  try {
    const res: any = await charterApi.active()
    activeCharters.value = res.data || []
  } catch (error) {
    console.error('Failed to fetch active charters:', error)
    activeCharters.value = []
  }
}

const fetchDefinitions = async () => {
  try {
    const res: any = await charterApi.definitions()
    availableCharters.value = res.data || getDefaultCharters()
  } catch (error) {
    console.error('Failed to fetch definitions:', error)
    availableCharters.value = getDefaultCharters()
  }
}

const getDefaultCharters = (): CharterDefinition[] => [
  {
    type: 'academic',
    name: '学术写作许可证',
    description: '解锁论文写作、文献综述、引用格式化能力',
    icon: '📚',
    capabilities: [
      { name: 'paper-writing', description: '撰写学术论文' },
      { name: 'literature-review', description: '文献综述' },
      { name: 'citation-format', description: '引用格式化' },
    ],
    disclaimer: '此许可证启用学术写作功能。所有引用必须可追溯到可靠来源。用户需确保准确性并避免抄袭。',
  },
  {
    type: 'legal',
    name: '法律文档许可证',
    description: '解锁合同起草、免责声明生成、法律分析能力',
    icon: '⚖️',
    capabilities: [
      { name: 'contract-draft', description: '起草合同' },
      { name: 'disclaimer-generate', description: '生成免责声明' },
      { name: 'legal-analysis', description: '法律分析' },
    ],
    disclaimer: '此许可证仅提供文档模板参考，不构成法律建议。请咨询专业律师。',
  },
  {
    type: 'longdoc',
    name: '长文档许可证',
    description: '解锁长文档处理能力，支持分区处理突破上下文限制',
    icon: '📄',
    capabilities: [
      { name: 'long-document-write', description: '长文档写作' },
      { name: 'document-merge', description: '文档合并' },
      { name: 'toc-generate', description: '目录生成' },
    ],
  },
]

onMounted(() => {
  fetchActiveCharters()
  fetchDefinitions()
})
</script>

<style scoped>
.charter-page {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.charter-header {
  margin-bottom: 32px;
}

.charter-header h1 {
  font-size: var(--cb-text-2xl);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 8px;
}

.subtitle {
  color: var(--cb-text-secondary);
}

.section {
  margin-bottom: 32px;
}

.section h2 {
  font-size: var(--cb-text-lg);
  font-weight: 500;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.empty-state {
  padding: 40px;
  text-align: center;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-lg);
  color: var(--cb-text-tertiary);
}

.charter-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.charter-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: var(--cb-bg-elevated);
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-lg);
}

.charter-card.active {
  border-color: var(--cb-primary);
  background: var(--cb-primary-bg);
}

.charter-info {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.charter-icon {
  font-size: 32px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
}

.charter-details h3 {
  font-size: var(--cb-text-base);
  font-weight: 500;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.charter-desc {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
  margin-bottom: 8px;
}

.charter-meta {
  display: flex;
  gap: 16px;
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}

.charter-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.capability-tag {
  padding: 2px 8px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-sm);
  font-size: var(--cb-text-xs);
  color: var(--cb-text-secondary);
}

.btn-apply, .btn-revoke {
  padding: 8px 16px;
  border-radius: var(--cb-radius-md);
  font-size: var(--cb-text-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-apply {
  background: var(--cb-primary);
  color: white;
  border: none;
}

.btn-apply:hover {
  background: var(--cb-primary-hover);
}

.btn-revoke {
  background: transparent;
  color: var(--cb-danger);
  border: 1px solid var(--cb-danger);
}

.btn-revoke:hover {
  background: var(--cb-danger);
  color: white;
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
  max-width: 480px;
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
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--cb-text-tertiary);
  cursor: pointer;
}

.modal-body {
  padding: 20px;
}

.form-item {
  margin-bottom: 16px;
}

.form-item label {
  display: block;
  font-size: var(--cb-text-sm);
  font-weight: 500;
  color: var(--cb-text-secondary);
  margin-bottom: 8px;
}

.form-item textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-size: var(--cb-text-base);
  resize: vertical;
}

.disclaimer {
  padding: 12px;
  background: var(--cb-warning-bg);
  border-radius: var(--cb-radius-md);
  font-size: var(--cb-text-sm);
  color: var(--cb-warning-text);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--cb-border-light);
}

.btn {
  padding: 8px 20px;
  border-radius: var(--cb-radius-md);
  font-size: var(--cb-text-sm);
  font-weight: 500;
  cursor: pointer;
}

.btn.primary {
  background: var(--cb-primary);
  color: white;
  border: none;
}

.btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.secondary {
  background: var(--cb-bg-sunken);
  color: var(--cb-text-primary);
  border: 1px solid var(--cb-border);
}
</style>
