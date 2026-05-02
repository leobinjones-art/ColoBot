<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('nav.agents') }}</h1>
        <p class="cb-page-desc">管理 AI Agent</p>
      </div>
      <button class="btn-primary" @click="showCreateModal = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('common.create') }}
      </button>
    </div>

    <div class="agent-grid">
      <div v-for="agent in agents" :key="agent.id" class="cb-card agent-card">
        <div class="agent-header">
          <div class="agent-icon">{{ agent.icon || '🤖' }}</div>
          <div class="agent-info">
            <h3 class="agent-name">{{ agent.name }}</h3>
            <span class="agent-type">{{ agent.agentType }}</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" :checked="agent.enabled" @change="toggleAgent(agent)" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <p class="agent-desc">{{ agent.description || 'No description' }}</p>
      </div>
    </div>

    <div v-if="agents.length === 0" class="empty-state">
      <p>暂无 Agent，点击上方按钮创建</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAgentStore } from '@/stores/useAgentStore'

const { t } = useI18n()
const agentStore = useAgentStore()
const agents = computed(() => agentStore.agents)

const showCreateModal = false

function toggleAgent(agent: any) {
  agentStore.updateAgent(agent.id, { enabled: !agent.enabled })
}

onMounted(() => {
  agentStore.fetchAgents()
})
</script>

<style scoped>
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.agent-card {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.agent-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--cb-shadow-medium);
}

.agent-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.agent-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
}

.agent-info {
  flex: 1;
}

.agent-name {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 2px;
}

.agent-type {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
  text-transform: uppercase;
}

.agent-desc {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
  line-height: 1.5;
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

.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--cb-text-tertiary);
}
</style>