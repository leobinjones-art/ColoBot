<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">AI 助手</h1>
        <p class="cb-page-desc">选择你想用的 AI</p>
      </div>
    </div>

    <div class="agent-grid">
      <div v-for="agent in agents" :key="agent.id" class="cb-card agent-card">
        <div class="agent-header">
          <div class="agent-icon">{{ agent.icon || '🤖' }}</div>
          <div class="agent-info">
            <h3 class="agent-name">{{ agent.name }}</h3>
            <span class="agent-desc">{{ agent.description || 'AI 助手' }}</span>
          </div>
          <label class="toggle-switch" @click.stop>
            <input type="checkbox" :checked="agent.enabled" @change="toggleAgent(agent)" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <div v-if="agents.length === 0" class="empty-state">
      <div class="empty-icon">🤖</div>
      <p>暂无 AI 助手</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAgentStore } from '@/stores/useAgentStore'
import { agentApi } from '@/api'
import type { Agent } from '@/types'

const { t } = useI18n()
const agentStore = useAgentStore()
const agents = computed(() => agentStore.agents)

async function toggleAgent(agent: Agent) {
  try {
    await agentApi.update(agent.id, { enabled: !agent.enabled })
    agent.enabled = !agent.enabled
  } catch (e) {
    console.error('Failed to toggle agent', e)
  }
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
  padding: 16px;
}

.agent-header {
  display: flex;
  align-items: center;
  gap: 12px;
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

.agent-desc {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
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
  padding: 64px 48px;
  color: var(--cb-text-tertiary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
</style>
