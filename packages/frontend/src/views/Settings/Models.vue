<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">AI 模型</h1>
        <p class="cb-page-desc">选择对话使用的 AI 模型</p>
      </div>
    </div>

    <!-- 默认模型选择 -->
    <div class="model-section cb-card">
      <h3>选择模型</h3>
      <div class="model-list">
        <div
          v-for="model in models"
          :key="model.id"
          class="model-item"
          :class="{ active: selectedModel === model.id }"
          @click="selectModel(model.id)"
        >
          <div class="model-icon">{{ model.icon }}</div>
          <div class="model-info">
            <span class="model-name">{{ model.name }}</span>
            <span class="model-desc">{{ model.description }}</span>
          </div>
          <div v-if="selectedModel === model.id" class="model-check">✓</div>
        </div>
      </div>
    </div>

    <!-- API Key 设置 -->
    <div class="apikey-section cb-card">
      <h3>API 密钥</h3>
      <div class="apikey-form">
        <label>密钥</label>
        <div class="apikey-input">
          <input
            :type="showApiKey ? 'text' : 'password'"
            v-model="apiKey"
            placeholder="sk-..."
          />
          <button class="toggle-visibility" @click="showApiKey = !showApiKey">
            {{ showApiKey ? '隐藏' : '显示' }}
          </button>
        </div>
        <p class="apikey-hint">密钥仅存储在你的设备上，不会上传到任何服务器</p>
      </div>
      <button class="btn-primary" @click="saveApiKey">保存</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const selectedModel = ref('gpt-4o')
const apiKey = ref('')
const showApiKey = ref(false)

const models = [
  { id: 'gpt-4o', name: 'GPT-4o', icon: '🤖', description: 'OpenAI 最新模型，智能且快速' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', icon: '⚡', description: '轻量版，速度更快' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet', icon: '🧠', description: 'Anthropic 出品，擅长分析' },
  { id: 'deepseek-chat', name: 'DeepSeek', icon: '🌟', description: '国产模型，性价比高' },
]

function selectModel(modelId: string) {
  selectedModel.value = modelId
  localStorage.setItem('colobot_model', modelId)
}

function saveApiKey() {
  localStorage.setItem('colobot_api_key', apiKey.value)
  alert('已保存')
}

onMounted(() => {
  const savedModel = localStorage.getItem('colobot_model')
  if (savedModel) selectedModel.value = savedModel

  const savedKey = localStorage.getItem('colobot_api_key')
  if (savedKey) apiKey.value = savedKey
})
</script>

<style scoped>
.model-section,
.apikey-section {
  padding: 20px;
  margin-bottom: 16px;
}

.model-section h3,
.apikey-section h3 {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 16px;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--cb-bg-sunken);
  border: 2px solid transparent;
  border-radius: var(--cb-radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.model-item:hover {
  border-color: var(--cb-border);
}

.model-item.active {
  border-color: var(--cb-primary);
  background: var(--cb-primary-bg);
}

.model-icon {
  font-size: 24px;
}

.model-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-name {
  font-size: var(--cb-text-base);
  font-weight: 500;
  color: var(--cb-text-primary);
}

.model-desc {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}

.model-check {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cb-primary);
  color: white;
  border-radius: 50%;
  font-size: 14px;
}

.apikey-form {
  margin-bottom: 16px;
}

.apikey-form label {
  display: block;
  font-size: var(--cb-text-sm);
  font-weight: 500;
  color: var(--cb-text-secondary);
  margin-bottom: 8px;
}

.apikey-input {
  display: flex;
  gap: 8px;
}

.apikey-input input {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-size: var(--cb-text-base);
}

.apikey-input input:focus {
  outline: none;
  border-color: var(--cb-primary);
}

.toggle-visibility {
  padding: 0 12px;
  background: var(--cb-bg-sunken);
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  color: var(--cb-text-secondary);
  font-size: var(--cb-text-sm);
  cursor: pointer;
}

.toggle-visibility:hover {
  background: var(--cb-border);
}

.apikey-hint {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
  margin-top: 8px;
}

.btn-primary {
  padding: 10px 24px;
  background: var(--cb-primary);
  border: none;
  border-radius: var(--cb-radius-md);
  color: white;
  font-size: var(--cb-text-sm);
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--cb-primary-hover);
}
</style>