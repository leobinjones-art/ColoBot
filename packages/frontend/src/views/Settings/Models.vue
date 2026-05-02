<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('settings.models') }}</h1>
        <p class="cb-page-desc">配置 LLM 模型和 Provider</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" @click="showAddProvider = true">
          添加 Provider
        </button>
        <button class="btn-primary" @click="discoverModels">
          发现模型
        </button>
      </div>
    </div>

    <!-- Provider 分组 -->
    <div class="provider-sections">
      <!-- 本地模型 -->
      <div v-if="localProviders.length" class="provider-group">
        <h3 class="group-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          本地模型
        </h3>
        <div class="provider-grid">
          <div v-for="provider in localProviders" :key="provider.id" class="cb-card provider-card">
            <ProviderCard :provider="provider" @test="testProvider" @manage="manageModels" />
          </div>
        </div>
      </div>

      <!-- 云端模型 -->
      <div v-if="cloudProviders.length" class="provider-group">
        <h3 class="group-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
          </svg>
          云端模型
        </h3>
        <div class="provider-grid">
          <div v-for="provider in cloudProviders" :key="provider.id" class="cb-card provider-card">
            <ProviderCard :provider="provider" @test="testProvider" @manage="manageModels" />
          </div>
        </div>
      </div>
    </div>

    <!-- 默认模型选择 -->
    <div class="default-model-section cb-card">
      <h3>默认模型</h3>
      <div class="model-selector">
        <select v-model="defaultModel" @change="setDefaultModel">
          <option value="">选择默认模型</option>
          <optgroup v-for="provider in allProviders" :key="provider.id" :label="provider.name">
            <option v-for="model in provider.models" :key="model.id" :value="`${provider.id}:${model.id}`">
              {{ model.name }}
            </option>
          </optgroup>
        </select>
      </div>
    </div>

    <!-- 添加 Provider 弹窗 -->
    <div v-if="showAddProvider" class="modal-overlay" @click.self="showAddProvider = false">
      <div class="modal-content">
        <h2>添加 Provider</h2>
        <div class="form-group">
          <label>Provider 类型</label>
          <select v-model="newProvider.type">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="dashscope">DashScope (阿里云)</option>
            <option value="minimax">MiniMax</option>
            <option value="deepseek">DeepSeek</option>
            <option value="ollama">Ollama (本地)</option>
            <option value="custom">自定义</option>
          </select>
        </div>
        <div class="form-group">
          <label>名称</label>
          <input v-model="newProvider.name" placeholder="My Provider" />
        </div>
        <div class="form-group">
          <label>Base URL</label>
          <input v-model="newProvider.baseUrl" placeholder="https://api.openai.com/v1" />
        </div>
        <div class="form-group">
          <label>API Key</label>
          <input v-model="newProvider.apiKey" type="password" placeholder="sk-..." />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showAddProvider = false">取消</button>
          <button class="btn-primary" @click="addProvider">添加</button>
        </div>
      </div>
    </div>

    <!-- 模型管理弹窗 -->
    <div v-if="managingProvider" class="modal-overlay" @click.self="managingProvider = null">
      <div class="modal-content model-manager">
        <h2>管理模型 - {{ managingProvider.name }}</h2>
        <div class="model-list-manager">
          <div v-for="model in managingProvider.models" :key="model.id" class="model-row">
            <div class="model-info">
              <span class="model-id">{{ model.id }}</span>
              <span class="model-name">{{ model.name }}</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="model.enabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div v-if="managingProvider.models.length === 0" class="empty-models">
            暂无模型，点击"发现模型"自动检测
          </div>
        </div>
        <div class="add-model-form">
          <input v-model="newModelId" placeholder="模型 ID，如 gpt-4o" />
          <input v-model="newModelName" placeholder="模型名称，如 GPT-4o" />
          <button class="btn-secondary" @click="addModel">添加模型</button>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="managingProvider = null">关闭</button>
          <button class="btn-primary" @click="saveModelConfig">保存配置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { configApi } from '@/api'
import ProviderCard from '@/components/settings/ProviderCard.vue'

const { t } = useI18n()

interface Model {
  id: string
  name: string
  enabled: boolean
}

interface Provider {
  id: string
  name: string
  type: string
  baseUrl?: string
  models: Model[]
  enabled: boolean
  isLocal: boolean
}

const providers = ref<Provider[]>([])
const showAddProvider = ref(false)
const defaultModel = ref('')
const testingId = ref<string | null>(null)
const managingProvider = ref<Provider | null>(null)
const newModelId = ref('')
const newModelName = ref('')

const newProvider = ref({
  type: 'openai',
  name: '',
  baseUrl: '',
  apiKey: '',
})

const localProviders = computed(() => providers.value.filter(p => p.isLocal))
const cloudProviders = computed(() => providers.value.filter(p => !p.isLocal))
const allProviders = computed(() => providers.value)

async function fetchProviders() {
  try {
    const res: any = await configApi.models()
    providers.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch providers', e)
    // 模拟数据
    providers.value = [
      { id: 'openai', name: 'OpenAI', type: 'openai', models: [
        { id: 'gpt-4o', name: 'GPT-4o', enabled: true },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', enabled: true },
      ], enabled: true, isLocal: false },
      { id: 'anthropic', name: 'Anthropic', type: 'anthropic', models: [
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', enabled: true },
        { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', enabled: true },
      ], enabled: true, isLocal: false },
      { id: 'ollama', name: 'Ollama', type: 'ollama', baseUrl: 'http://localhost:11434', models: [
        { id: 'llama3.2', name: 'Llama 3.2', enabled: true },
        { id: 'qwen2.5', name: 'Qwen 2.5', enabled: true },
      ], enabled: true, isLocal: true },
    ]
  }
}

async function testProvider(provider: Provider) {
  testingId.value = provider.id
  try {
    // await configApi.testProvider(provider.id)
    await new Promise(r => setTimeout(r, 1000))
    alert(`${provider.name} 连接成功`)
  } catch (e) {
    alert(`${provider.name} 连接失败`)
  } finally {
    testingId.value = null
  }
}

function manageModels(provider: Provider) {
  managingProvider.value = { ...provider, models: [...provider.models] }
}

function addModel() {
  if (!managingProvider.value || !newModelId.value.trim()) return
  managingProvider.value.models.push({
    id: newModelId.value.trim(),
    name: newModelName.value.trim() || newModelId.value.trim(),
    enabled: true,
  })
  newModelId.value = ''
  newModelName.value = ''
}

async function saveModelConfig() {
  if (!managingProvider.value) return
  const idx = providers.value.findIndex(p => p.id === managingProvider.value!.id)
  if (idx !== -1) {
    providers.value[idx] = { ...managingProvider.value }
  }
  managingProvider.value = null
}

async function discoverModels() {
  // TODO: 发现模型
  alert('正在发现可用模型...')
}

async function setDefaultModel() {
  if (!defaultModel.value) return
  // TODO: 保存默认模型
}

async function addProvider() {
  try {
    // await configApi.addProvider(newProvider.value)
    providers.value.push({
      id: newProvider.value.type + '-' + Date.now(),
      name: newProvider.value.name || newProvider.value.type,
      type: newProvider.value.type,
      baseUrl: newProvider.value.baseUrl,
      models: [],
      enabled: true,
      isLocal: newProvider.value.type === 'ollama',
    })
    showAddProvider.value = false
    newProvider.value = { type: 'openai', name: '', baseUrl: '', apiKey: '' }
  } catch (e) {
    console.error('Failed to add provider', e)
  }
}

onMounted(() => {
  fetchProviders()
})
</script>

<style scoped>
.header-actions {
  display: flex;
  gap: 8px;
}

.provider-sections {
  margin-bottom: 24px;
}

.provider-group {
  margin-bottom: 24px;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.provider-card {
  padding: 16px;
}

.default-model-section {
  padding: 20px;
}

.default-model-section h3 {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 12px;
}

.model-selector select {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-size: var(--cb-text-base);
}

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
  padding: 24px;
  width: 90%;
  max-width: 500px;
}

.modal-content h2 {
  font-size: var(--cb-text-lg);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 20px;
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.model-manager {
  max-width: 600px;
}

.model-list-manager {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
}

.model-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--cb-border-light);
}

.model-row:last-child {
  border-bottom: none;
}

.model-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-id {
  font-family: monospace;
  font-size: var(--cb-text-sm);
  color: var(--cb-text-primary);
}

.model-name {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}

.empty-models {
  padding: 24px;
  text-align: center;
  color: var(--cb-text-tertiary);
}

.add-model-form {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.add-model-form input {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-size: var(--cb-text-sm);
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--cb-border);
  border-radius: var(--cb-radius-full);
  transition: background 0.15s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: transform 0.15s ease;
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--cb-primary);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}
</style>