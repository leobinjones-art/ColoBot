<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('nav.skills') }}</h1>
        <p class="cb-page-desc">管理技能和 SOP 流程</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('common.create') }}
      </button>
    </div>

    <!-- 技能分类筛选 -->
    <div class="skill-filters">
      <button class="filter-chip" :class="{ active: filterType === '' }" @click="filterType = ''">全部</button>
      <button class="filter-chip" :class="{ active: filterType === 'sop' }" @click="filterType = 'sop'">SOP 流程</button>
      <button class="filter-chip" :class="{ active: filterType === 'tool' }" @click="filterType = 'tool'">工具</button>
      <button class="filter-chip" :class="{ active: filterType === 'agent' }" @click="filterType = 'agent'">Agent</button>
    </div>

    <div class="skill-grid">
      <div v-for="skill in filteredSkills" :key="skill.id" class="cb-card skill-card" @click="openEditModal(skill)">
        <div class="skill-header">
          <div class="skill-icon">{{ skill.icon || '⚡' }}</div>
          <div class="skill-info">
            <h3 class="skill-name">{{ skill.nameZh || skill.name }}</h3>
            <span class="skill-type">{{ getSkillTypeLabel(skill.skillType) }}</span>
          </div>
          <label class="toggle-switch" @click.stop>
            <input type="checkbox" :checked="skill.enabled" @change="toggleSkill(skill)" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <p class="skill-desc">{{ skill.description || 'No description' }}</p>
        <div class="skill-footer">
          <span class="skill-status" :class="skill.securityScanStatus || 'pending'">
            {{ getSecurityStatusLabel(skill.securityScanStatus) }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="skills.length === 0" class="empty-state">
      <div class="empty-icon">⚡</div>
      <p>暂无技能</p>
      <button class="btn-secondary" @click="openCreateModal">创建第一个技能</button>
    </div>

    <!-- 创建/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h2>{{ editingSkill ? '编辑技能' : '创建技能' }}</h2>
        <form @submit.prevent="saveSkill">
          <div class="form-row">
            <div class="form-group">
              <label>名称 (中文)</label>
              <input v-model="form.nameZh" type="text" required placeholder="技能名称" />
            </div>
            <div class="form-group">
              <label>名称 (英文)</label>
              <input v-model="form.name" type="text" placeholder="skill_name" />
            </div>
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="form.description" rows="2" placeholder="技能功能描述"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>类型</label>
              <select v-model="form.skillType">
                <option value="sop">SOP 流程</option>
                <option value="tool">工具</option>
                <option value="agent">Agent</option>
              </select>
            </div>
            <div class="form-group">
              <label>图标</label>
              <div class="icon-picker">
                <button v-for="icon in iconOptions" :key="icon" type="button" class="icon-opt" :class="{ active: form.icon === icon }" @click="form.icon = icon">{{ icon }}</button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>技能定义 (JSON)</label>
            <textarea v-model="form.definition" rows="6" placeholder='{"trigger": "...", "steps": [...]}' class="code-input"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="closeModal">{{ t('common.cancel') }}</button>
            <button v-if="editingSkill" type="button" class="btn-danger" @click="deleteSkill">{{ t('common.delete') }}</button>
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
import { skillApi } from '@/api'
import type { Skill } from '@/types'

const { t } = useI18n()
const skills = ref<Skill[]>([])
const showModal = ref(false)
const editingSkill = ref<Skill | null>(null)
const filterType = ref('')

const iconOptions = ['⚡', '🔧', '📝', '🔍', '📊', '🤖', '🎯', '💡', '🧠', '🚀']

const form = ref({
  name: '',
  nameZh: '',
  description: '',
  skillType: 'sop',
  icon: '⚡',
  definition: ''
})

const filteredSkills = computed(() => {
  if (!filterType.value) return skills.value
  return skills.value.filter(s => s.skillType === filterType.value)
})

function getSkillTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    sop: 'SOP 流程',
    tool: '工具',
    agent: 'Agent'
  }
  return labels[type] || type
}

function getSecurityStatusLabel(status: string | undefined): string {
  const labels: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝'
  }
  return labels[status || 'pending'] || '待审核'
}

function openCreateModal() {
  editingSkill.value = null
  form.value = { name: '', nameZh: '', description: '', skillType: 'sop', icon: '⚡', definition: '' }
  showModal.value = true
}

function openEditModal(skill: Skill) {
  editingSkill.value = skill
  form.value = {
    name: skill.name || '',
    nameZh: skill.nameZh || '',
    description: skill.description || '',
    skillType: skill.skillType || 'sop',
    icon: skill.icon || '⚡',
    definition: ''
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingSkill.value = null
}

async function fetchSkills() {
  try {
    const res: any = await skillApi.page({})
    skills.value = res.data?.records || []
  } catch (e) {
    console.error('Failed to fetch skills', e)
    // Mock data
    skills.value = [
      { id: '1', name: 'academic_research', nameZh: '学术研究', skillType: 'sop', icon: '📚', enabled: true, description: '学术论文检索、阅读、总结流程' },
      { id: '2', name: 'code_review', nameZh: '代码审查', skillType: 'sop', icon: '🔍', enabled: true, description: '自动代码审查和优化建议' },
      { id: '3', name: 'translate', nameZh: '翻译助手', skillType: 'tool', icon: '🌐', enabled: true, description: '多语言翻译工具' },
    ]
  }
}

async function toggleSkill(skill: Skill) {
  try {
    await skillApi.toggle(skill.id, !skill.enabled)
    skill.enabled = !skill.enabled
  } catch (e) {
    console.error('Failed to toggle skill', e)
  }
}

async function saveSkill() {
  try {
    if (editingSkill.value) {
      await skillApi.update(editingSkill.value.id, form.value)
      Object.assign(editingSkill.value, form.value)
    } else {
      const res: any = await skillApi.create(form.value)
      skills.value.push(res.data)
    }
    closeModal()
  } catch (e) {
    console.error('Failed to save skill', e)
  }
}

async function deleteSkill() {
  if (!editingSkill.value || !confirm('确定要删除这个技能吗？')) return
  try {
    await skillApi.delete(editingSkill.value.id)
    skills.value = skills.value.filter(s => s.id !== editingSkill.value!.id)
    closeModal()
  } catch (e) {
    console.error('Failed to delete skill', e)
  }
}

onMounted(() => {
  fetchSkills()
})
</script>

<style scoped>
.skill-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.filter-chip {
  padding: 6px 14px;
  background: var(--cb-bg-sunken);
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-full);
  font-size: 13px;
  color: var(--cb-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-chip:hover {
  background: var(--cb-sidebar-hover);
}

.filter-chip.active {
  background: var(--cb-primary);
  border-color: var(--cb-primary);
  color: white;
}

.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.skill-card {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.skill-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--cb-shadow-medium);
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.skill-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
}

.skill-info {
  flex: 1;
}

.skill-name {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 2px;
}

.skill-type {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
  text-transform: uppercase;
}

.skill-desc {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
}

.skill-footer {
  display: flex;
  justify-content: flex-end;
}

.skill-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--cb-radius-sm);
}

.skill-status.pending {
  background: rgba(245, 158, 11, 0.1);
  color: var(--cb-warning);
}

.skill-status.approved {
  background: rgba(34, 197, 94, 0.1);
  color: var(--cb-success);
}

.skill-status.rejected {
  background: rgba(239, 68, 68, 0.1);
  color: var(--cb-danger);
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
  cursor: pointer;
  font-size: 16px;
}

.icon-opt:hover {
  background: var(--cb-sidebar-hover);
}

.icon-opt.active {
  border-color: var(--cb-primary);
}

.code-input {
  font-family: monospace;
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
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.btn-secondary {
  padding: 10px 16px;
  background: var(--cb-bg-sunken);
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  color: var(--cb-text-secondary);
  cursor: pointer;
}

.btn-primary {
  padding: 10px 16px;
  background: var(--cb-primary);
  border: none;
  border-radius: var(--cb-radius-md);
  color: white;
  cursor: pointer;
}

.btn-danger {
  padding: 10px 16px;
  background: transparent;
  border: 1px solid var(--cb-danger);
  border-radius: var(--cb-radius-md);
  color: var(--cb-danger);
  cursor: pointer;
}
</style>