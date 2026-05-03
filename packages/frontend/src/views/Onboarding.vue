<template>
  <div class="onboarding-page">
    <div class="onboarding-container">
      <!-- Step 1: 语言选择 -->
      <div v-if="currentStep === 1" class="step-content">
        <h1>{{ t('onboarding.welcome') }}</h1>
        <p class="step-desc">{{ t('onboarding.selectLanguage') }}</p>
        <div class="language-options">
          <button
            class="language-btn"
            :class="{ active: selectedLanguage === 'zh-CN' }"
            @click="selectedLanguage = 'zh-CN'"
          >
            <span class="flag">🇨🇳</span>
            <span>中文</span>
          </button>
          <button
            class="language-btn"
            :class="{ active: selectedLanguage === 'en' }"
            @click="selectedLanguage = 'en'"
          >
            <span class="flag">🇺🇸</span>
            <span>English</span>
          </button>
        </div>
      </div>

      <!-- Step 2: API Key 设置 -->
      <div v-if="currentStep === 2" class="step-content">
        <h1>{{ t('onboarding.setupApiKey') }}</h1>
        <p class="step-desc">{{ t('onboarding.apiKeyDesc') }}</p>

        <div class="provider-select">
          <label>{{ t('onboarding.selectProvider') }}</label>
          <div class="provider-options">
            <button
              v-for="provider in providers"
              :key="provider.id"
              class="provider-btn"
              :class="{ active: selectedProvider === provider.id }"
              @click="selectedProvider = provider.id"
            >
              <span class="provider-icon">{{ provider.icon }}</span>
              <span>{{ provider.name }}</span>
            </button>
          </div>
        </div>

        <div class="api-key-input">
          <label>API Key</label>
          <input
            v-model="apiKey"
            type="password"
            placeholder="sk-..."
            :class="{ error: apiKeyError }"
          />
          <p v-if="apiKeyError" class="error-msg">{{ apiKeyError }}</p>
        </div>

        <div class="help-link">
          <a href="#" @click.prevent="showTutorial = true">
            💡 {{ t('onboarding.howToGetKey') }}
          </a>
        </div>
      </div>

      <!-- Step 3: 关心程度 -->
      <div v-if="currentStep === 3" class="step-content">
        <h1>{{ t('onboarding.careLevel') }}</h1>

        <div class="care-options">
          <button
            class="care-btn"
            :class="{ active: careLevel === 'passive' }"
            @click="careLevel = 'passive'"
          >
            <div class="care-icon">🔇</div>
            <div class="care-label">{{ t('onboarding.passiveDesc') }}</div>
          </button>

          <button
            class="care-btn"
            :class="{ active: careLevel === 'greet' }"
            @click="careLevel = 'greet'"
          >
            <div class="care-icon">👋</div>
            <div class="care-label">{{ t('onboarding.greetDesc') }}</div>
          </button>

          <button
            class="care-btn"
            :class="{ active: careLevel === 'care' }"
            @click="careLevel = 'care'"
          >
            <div class="care-icon">💝</div>
            <div class="care-label">{{ t('onboarding.careDesc') }}</div>
          </button>
        </div>

        <p class="hint">{{ t('onboarding.canChangeLater') }}</p>
      </div>

      <!-- 导航按钮 -->
      <div class="step-actions">
        <button v-if="currentStep > 1" class="btn secondary" @click="prevStep">
          {{ t('common.cancel') }}
        </button>
        <button
          v-if="currentStep < 3"
          class="btn primary"
          :disabled="!canProceed"
          @click="nextStep"
        >
          {{ t('onboarding.next') }}
        </button>
        <button
          v-if="currentStep === 3"
          class="btn primary"
          @click="complete"
        >
          {{ t('onboarding.start') }}
        </button>
      </div>

      <!-- 步骤指示器 -->
      <div class="step-indicator">
        <span
          v-for="i in 3"
          :key="i"
          class="dot"
          :class="{ active: i === currentStep, completed: i < currentStep }"
        ></span>
      </div>
    </div>

    <!-- 教程弹窗 -->
    <div v-if="showTutorial" class="modal-overlay" @click="showTutorial = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>如何获取 API Key</h3>
          <button class="close-btn" @click="showTutorial = false">×</button>
        </div>
        <div class="modal-body">
          <div class="tutorial-section">
            <h4>OpenAI (ChatGPT)</h4>
            <ol>
              <li>访问 <a href="https://platform.openai.com" target="_blank">platform.openai.com</a></li>
              <li>注册/登录账号</li>
              <li>进入 API Keys 页面</li>
              <li>点击 "Create new secret key"</li>
              <li>复制生成的 Key</li>
            </ol>
          </div>
          <div class="tutorial-section">
            <h4>Anthropic (Claude)</h4>
            <ol>
              <li>访问 <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a></li>
              <li>注册/登录账号</li>
              <li>进入 API Keys 页面</li>
              <li>点击 "Create Key"</li>
              <li>复制生成的 Key</li>
            </ol>
          </div>
          <div class="tutorial-note">
            <p>💡 API Key 仅存储在你的设备上，ColoBot 不会上传到任何服务器。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t, locale } = useI18n()
const router = useRouter()

const currentStep = ref(1)
const selectedLanguage = ref('zh-CN')
const selectedProvider = ref('openai')
const apiKey = ref('')
const apiKeyError = ref('')
const careLevel = ref('greet')
const showTutorial = ref(false)

const providers = [
  { id: 'openai', name: 'ChatGPT', icon: '🤖' },
  { id: 'anthropic', name: 'Claude', icon: '🧠' },
  { id: 'minimax', name: 'MiniMax', icon: '🌟' },
  { id: 'other', name: '其他', icon: '⚙️' },
]

const canProceed = computed(() => {
  if (currentStep.value === 1) {
    return selectedLanguage.value !== ''
  }
  if (currentStep.value === 2) {
    return apiKey.value.trim().length > 0
  }
  return true
})

watch(selectedLanguage, (lang) => {
  locale.value = lang
})

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

function nextStep() {
  if (currentStep.value === 2) {
    // 验证 API Key
    if (!apiKey.value.trim()) {
      apiKeyError.value = '请输入 API Key'
      return
    }
    apiKeyError.value = ''
  }

  if (currentStep.value < 3) {
    currentStep.value++
  }
}

function complete() {
  // 保存设置
  localStorage.setItem('colobot_language', selectedLanguage.value)
  localStorage.setItem('colobot_provider', selectedProvider.value)
  localStorage.setItem('colobot_api_key', apiKey.value)
  localStorage.setItem('colobot_care_level', careLevel.value)
  localStorage.setItem('colobot_onboarded', 'true')

  // 跳转到主页
  router.push('/chat')
}
</script>

<style scoped>
.onboarding-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--cb-bg) 0%, var(--cb-bg-sunken) 100%);
  padding: 24px;
}

.onboarding-container {
  width: 100%;
  max-width: 480px;
  background: var(--cb-bg-elevated);
  border-radius: var(--cb-radius-xl);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  padding: 40px;
}

.step-content {
  text-align: center;
  margin-bottom: 32px;
}

.step-content h1 {
  font-size: var(--cb-text-2xl);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 12px;
}

.step-desc {
  font-size: var(--cb-text-base);
  color: var(--cb-text-secondary);
  margin-bottom: 32px;
}

.language-options {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.language-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 32px;
  background: var(--cb-bg-sunken);
  border: 2px solid var(--cb-border);
  border-radius: var(--cb-radius-lg);
  cursor: pointer;
  transition: all 0.15s ease;
}

.language-btn:hover {
  border-color: var(--cb-primary);
}

.language-btn.active {
  border-color: var(--cb-primary);
  background: var(--cb-primary-bg);
}

.flag {
  font-size: 32px;
}

.language-btn span:last-child {
  font-size: var(--cb-text-base);
  color: var(--cb-text-primary);
}

.provider-select {
  margin-bottom: 24px;
  text-align: left;
}

.provider-select label {
  display: block;
  font-size: var(--cb-text-sm);
  font-weight: 500;
  color: var(--cb-text-secondary);
  margin-bottom: 12px;
}

.provider-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.provider-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--cb-bg-sunken);
  border: 2px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: var(--cb-text-sm);
  color: var(--cb-text-primary);
}

.provider-btn:hover {
  border-color: var(--cb-primary);
}

.provider-btn.active {
  border-color: var(--cb-primary);
  background: var(--cb-primary-bg);
}

.provider-icon {
  font-size: 18px;
}

.api-key-input {
  margin-bottom: 16px;
  text-align: left;
}

.api-key-input label {
  display: block;
  font-size: var(--cb-text-sm);
  font-weight: 500;
  color: var(--cb-text-secondary);
  margin-bottom: 8px;
}

.api-key-input input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-size: var(--cb-text-base);
  transition: border-color 0.15s ease;
}

.api-key-input input:focus {
  outline: none;
  border-color: var(--cb-primary);
}

.api-key-input input.error {
  border-color: var(--cb-danger);
}

.error-msg {
  font-size: var(--cb-text-sm);
  color: var(--cb-danger);
  margin-top: 8px;
}

.help-link {
  text-align: center;
}

.help-link a {
  font-size: var(--cb-text-sm);
  color: var(--cb-primary);
  text-decoration: none;
}

.help-link a:hover {
  text-decoration: underline;
}

.care-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.care-btn {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--cb-bg-sunken);
  border: 2px solid var(--cb-border);
  border-radius: var(--cb-radius-lg);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.care-btn:hover {
  border-color: var(--cb-primary);
}

.care-btn.active {
  border-color: var(--cb-primary);
  background: var(--cb-primary-bg);
}

.care-icon {
  font-size: 28px;
  width: 48px;
  text-align: center;
}

.care-label {
  font-size: var(--cb-text-base);
  color: var(--cb-text-primary);
}

.hint {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-tertiary);
}

.step-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 24px;
}

.btn {
  padding: 12px 32px;
  border-radius: var(--cb-radius-md);
  font-size: var(--cb-text-base);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn.primary {
  background: var(--cb-primary);
  color: white;
  border: none;
}

.btn.primary:hover:not(:disabled) {
  background: var(--cb-primary-hover);
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

.btn.secondary:hover {
  background: var(--cb-border);
}

.step-indicator {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cb-border);
  transition: all 0.2s ease;
}

.dot.active {
  width: 24px;
  border-radius: 4px;
  background: var(--cb-primary);
}

.dot.completed {
  background: var(--cb-primary);
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

.tutorial-section {
  margin-bottom: 24px;
}

.tutorial-section:last-of-type {
  margin-bottom: 16px;
}

.tutorial-section h4 {
  font-size: var(--cb-text-base);
  font-weight: 500;
  color: var(--cb-text-primary);
  margin-bottom: 12px;
}

.tutorial-section ol {
  padding-left: 20px;
  color: var(--cb-text-secondary);
  font-size: var(--cb-text-sm);
  line-height: 1.8;
}

.tutorial-section a {
  color: var(--cb-primary);
}

.tutorial-note {
  padding: 12px 16px;
  background: var(--cb-primary-bg);
  border-radius: var(--cb-radius-md);
  font-size: var(--cb-text-sm);
  color: var(--cb-primary);
}
</style>
