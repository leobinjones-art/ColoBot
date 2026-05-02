<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <img src="/logo.svg" alt="ColoBot" class="login-logo" />
        <h1 class="login-title">ColoBot</h1>
        <p class="login-subtitle">{{ t('app.title') }}</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>{{ t('auth.username') }}</label>
          <input
            v-model="form.username"
            type="text"
            :placeholder="t('auth.username')"
            required
          />
        </div>

        <div class="form-group">
          <label>{{ t('auth.password') }}</label>
          <input
            v-model="form.password"
            type="password"
            :placeholder="t('auth.password')"
            required
          />
        </div>

        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? t('common.loading') : t('auth.login') }}
        </button>
      </form>

      <p v-if="error" class="login-error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { authApi } from '@/api'
import { setToken } from '@/utils/auth'

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const error = ref('')

const form = reactive({
  username: '',
  password: '',
})

async function handleLogin() {
  loading.value = true
  error.value = ''

  try {
    const res: any = await authApi.login(form)
    if (res.data?.token) {
      setToken(res.data.token)
      router.push('/')
    }
  } catch (e: any) {
    error.value = e.message || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cb-bg);
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: var(--cb-bg-elevated);
  border: 1px solid var(--cb-border-light);
  border-radius: var(--cb-radius-lg);
  padding: 32px;
  box-shadow: var(--cb-shadow-medium);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-logo {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
}

.login-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.login-subtitle {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: var(--cb-text-sm);
  font-weight: 500;
  color: var(--cb-text-secondary);
}

.form-group input {
  padding: 12px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  font-size: var(--cb-text-base);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  transition: border-color 0.15s ease;
}

.form-group input:focus {
  outline: none;
  border-color: var(--cb-primary);
}

.login-btn {
  padding: 12px;
  background: var(--cb-primary);
  color: white;
  border: none;
  border-radius: var(--cb-radius-md);
  font-size: var(--cb-text-base);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.login-btn:hover:not(:disabled) {
  background: var(--cb-primary-hover);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-error {
  margin-top: 16px;
  padding: 12px;
  background: var(--cb-danger);
  color: white;
  border-radius: var(--cb-radius-md);
  font-size: var(--cb-text-sm);
  text-align: center;
}
</style>