<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="confirm-overlay" @click.self="cancel">
        <div class="confirm-dialog">
          <div class="confirm-header">
            <h3>{{ title }}</h3>
          </div>
          <div class="confirm-body">
            <p>{{ message }}</p>
          </div>
          <div class="confirm-footer">
            <button class="btn-secondary" @click="cancel">{{ t('common.cancel') }}</button>
            <button class="btn-primary" @click="confirm">{{ t('common.confirm') }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const visible = ref(false)
const title = ref('')
const message = ref('')
let resolvePromise: ((value: boolean) => void) | null = null

function show(titleText: string, messageText: string): Promise<boolean> {
  title.value = titleText
  message.value = messageText
  visible.value = true
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

function confirm() {
  visible.value = false
  resolvePromise?.(true)
}

function cancel() {
  visible.value = false
  resolvePromise?.(false)
}

defineExpose({ show })
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog {
  background: var(--cb-bg-elevated);
  border-radius: var(--cb-radius-lg);
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: var(--cb-shadow-medium);
}

.confirm-header h3 {
  font-size: var(--cb-text-lg);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 12px;
}

.confirm-body p {
  color: var(--cb-text-secondary);
  margin-bottom: 24px;
}

.confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>