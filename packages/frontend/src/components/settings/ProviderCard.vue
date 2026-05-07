<template>
  <div class="provider-card-inner">
    <div class="provider-header">
      <div class="provider-icon">
        <svg
          v-if="provider.type === 'ollama'"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <svg
          v-else
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        </svg>
      </div>
      <div class="provider-name">{{ provider.name }}</div>
      <span class="provider-type-badge">{{ provider.type }}</span>
    </div>

    <div class="provider-models">
      <div v-for="model in provider.models.slice(0, 4)" :key="model.id" class="model-item">
        <span class="model-name">{{ model.name }}</span>
        <span class="model-status" :class="{ enabled: model.enabled }">
          {{ model.enabled ? '启用' : '禁用' }}
        </span>
      </div>
      <div v-if="provider.models.length > 4" class="more-models">
        +{{ provider.models.length - 4 }} 更多模型
      </div>
    </div>

    <div class="provider-actions">
      <button class="action-btn test-btn" @click="$emit('test', provider)">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        测试连接
      </button>
      <button class="action-btn manage-btn" @click="$emit('manage', provider)">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
        管理模型
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
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

defineProps<{
  provider: Provider
}>()

defineEmits<{
  test: [provider: Provider]
  manage: [provider: Provider]
}>()
</script>

<style scoped>
.provider-card-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-icon {
  color: var(--cb-text-secondary);
}

.provider-name {
  font-weight: 600;
  color: var(--cb-text-primary);
  flex: 1;
}

.provider-type-badge {
  padding: 2px 8px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-sm);
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}

.provider-models {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.model-name {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.model-status {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}

.model-status.enabled {
  color: var(--cb-success);
}

.more-models {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
  padding-top: 4px;
}

.provider-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-secondary);
  font-size: var(--cb-text-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--cb-sidebar-hover);
  color: var(--cb-text-primary);
}

.test-btn:hover {
  border-color: var(--cb-success);
  color: var(--cb-success);
}

.manage-btn:hover {
  border-color: var(--cb-primary);
  color: var(--cb-primary);
}
</style>
