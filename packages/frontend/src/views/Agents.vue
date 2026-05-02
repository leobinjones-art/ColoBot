<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('nav.agents') }}</h1>
        <p class="cb-page-desc">管理 AI Agent</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('common.create') }}
      </button>
    </div>

    <div class="agent-grid">
      <div v-for="agent in agents" :key="agent.id" class="cb-card agent-card" @click="openEditModal(agent)">
        <div class="agent-header">
          <div class="agent-icon">{{ agent.icon || '🤖' }}</div>
          <div class="agent-info">
            <h3 class="agent-name">{{ agent.name }}</h3>
            <span class="agent-type">{{ agent.agentType }}</span>
          </div>
          <label class="toggle-switch" @click.stop>
            <input type="checkbox" :checked="agent.enabled" @change="toggleAgent(agent)" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <p class="agent-desc">{{ agent.description || 'No description' }}</p>
        <div class="agent-meta">
          <span v-if="agent.modelName" class="meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            {{ agent.modelName }}
          </span>
          <span v-if="agent.tags" class="meta-item tags">
            <span v-for="tag in agent.tags.split(',')" :key="tag" class="tag">{{ tag.trim() }}</span>
          </span>
        </div>
      </div>
    </div>

    <div v-if="agents.length === 0" class="empty-state">
      <div class="empty-icon">🤖</div>
      <p>暂无 Agent，点击上方按钮创建</p>
    </div>

    <!-- 创建/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content agent-modal">
        <div class="modal-header">
          <h2>{{ editingAgent ? '编辑 Agent' : t('common.create') }}</h2>
          <button class="close-btn" @click="closeModal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form @submit.prevent="saveAgent">
          <div class="form-row">
            <div class="form-group">
              <label>名称 *</label>
              <input v-model="form.name" type="text" required placeholder="Agent 名称" />
            </div>
            <div class="form-group icon-picker-group">
              <label>图标</label>
              <div class="icon-picker">
                <button type="button" v-for="icon in iconOptions" :key="icon"
                  class="icon-opt" :class="{ active: form.icon === icon }"
                  @click="form.icon = icon">{{ icon }}</button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="form.description" rows="2" placeholder="Agent 功能描述"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>类型</label>
              <select v-model="form.agentType">
                <option value="react">ReAct</option>
                <option value="plan_execute">Plan & Execute</option>
              </select>
            </div>
            <div class="form-group">
              <label>模型</label>
              <select v-model="form.modelName">
                <option value="">默认模型</option>
                <option v-for="model in availableModels" :key="model" :value="model">{{ model }}</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>系统提示词</label>
            <textarea v-model="form.systemPrompt" rows="4" placeholder="定义 Agent 的角色和行为规则"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>最大迭代次数</label>
              <input v-model.number="form.maxIterations" type="number" min="1" max="50" />
            </div>
            <div class="form-group">
              <label>标签</label>
              <input v-model="form.tags" type="text" placeholder="标签1, 标签2" />
            </div>
          </div>
          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.enabled" />
              <span>启用 Agent</span>
            </label>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="closeModal">{{ t('common.cancel') }}</button>
            <button v-if="editingAgent" type="button" class="btn-danger" @click="deleteAgent">{{ t('common.delete') }}</button>
            <button type="submit" class="btn-primary">{{ t('common.save') }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAgentStore } from '@/stores/useAgentStore'
import { agentApi } from '@/api'
import type { Agent } from '@/types'

const { t } = useI18n()
const agentStore = useAgentStore()
const agents = computed(() => agentStore.agents)

const showModal = ref(false)
const editingAgent = ref<Agent | null>(null)

const iconOptions = ['🤖', '💻', '🔬', '📚', '🎨', '🔧', '📊', '🌐', '⚡', '🧠', '💼', '🎯']

const availableModels = ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4-6', 'claude-opus-4-7', 'deepseek-chat']

const form = ref({
  name: '',
  description: '',
  agentType: 'react' as 'react' | 'plan_execute',
  systemPrompt: '',
  modelName: '',
  maxIterations: 10,
  icon: '🤖',
  tags: '',
  enabled: true,
})

function openCreateModal() {
  editingAgent.value = null
  form.value = {
    name: '',
    description: '',
    agentType: 'react',
    systemPrompt: '',
    modelName: '',
    maxIterations: 10,
    icon: '🤖',
    tags: '',
    enabled: true,
  }
  showModal.value = true
}

function openEditModal(agent: Agent) {
  editingAgent.value = agent
  form.value = {
    name: agent.name,
    description: agent.description || '',
    agentType: agent.agentType,
    systemPrompt: agent.systemPrompt || '',
    modelName: agent.modelName || '',
    maxIterations: agent.maxIterations || 10,
    icon: agent.icon || '🤖',
    tags: agent.tags || '',
    enabled: agent.enabled,
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingAgent.value = null
}

async function saveAgent() {
  try {
    if (editingAgent.value) {
      await agentApi.update(editingAgent.value.id, form.value)
      agentStore.fetchAgents()
    } else {
      await agentApi.create(form.value)
      agentStore.fetchAgents()
    }
    closeModal()
  } catch (e) {
    console.error('Failed to save agent', e)
  }
}

async function deleteAgent() {
  if (!editingAgent.value) return
  if (!confirm(`确定要删除 Agent「${editingAgent.value.name}」吗？`)) return
  try {
    await agentApi.delete(editingAgent.value.id)
    agentStore.fetchAgents()
    closeModal()
  } catch (e) {
    console.error('Failed to delete agent', e)
  }
}

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
  margin-bottom: 12px;
}

.agent-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}

.meta-item.tags {
  gap: 4px;
}

.tag {
  padding: 2px 6px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-sm);
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
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--cb-border);
}

.modal-header h2 {
  font-size: var(--cb-text-lg);
  font-weight: 600;
  color: var(--cb-text-primary);
}

.close-btn {
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: var(--cb-radius-sm);
  color: var(--cb-text-tertiary);
  cursor: pointer;
}

.close-btn:hover {
  background: var(--cb-bg-sunken);
  color: var(--cb-text-primary);
}

.agent-modal form {
  padding: 24px;
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
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-size: var(--cb-text-base);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--cb-primary);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.icon-picker-group {
  min-width: 0;
}

.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.icon-opt {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cb-bg-sunken);
  border: 2px solid transparent;
  border-radius: var(--cb-radius-sm);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-opt:hover {
  background: var(--cb-sidebar-hover);
}

.icon-opt.active {
  border-color: var(--cb-primary);
  background: rgba(59, 130, 246, 0.1);
}

.checkbox-group {
  margin-top: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input {
  width: auto;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--cb-border);
}

.btn-secondary {
  padding: 10px 16px;
  background: var(--cb-bg-sunken);
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  color: var(--cb-text-secondary);
  cursor: pointer;
  font-size: var(--cb-text-sm);
}

.btn-secondary:hover {
  background: var(--cb-border);
}

.btn-primary {
  padding: 10px 16px;
  background: var(--cb-primary);
  border: none;
  border-radius: var(--cb-radius-md);
  color: white;
  cursor: pointer;
  font-size: var(--cb-text-sm);
}

.btn-primary:hover {
  background: var(--cb-primary-hover);
}

.btn-danger {
  padding: 10px 16px;
  background: transparent;
  border: 1px solid var(--cb-danger);
  border-radius: var(--cb-radius-md);
  color: var(--cb-danger);
  cursor: pointer;
  font-size: var(--cb-text-sm);
}

.btn-danger:hover {
  background: var(--cb-danger);
  color: white;
}
</style>