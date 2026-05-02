<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('nav.skills') }}</h1>
        <p class="cb-page-desc">管理技能和 SOP 流程</p>
      </div>
      <button class="btn-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('common.create') }}
      </button>
    </div>

    <div class="skill-grid">
      <div v-for="skill in skills" :key="skill.id" class="cb-card skill-card">
        <div class="skill-header">
          <div class="skill-icon">{{ skill.icon || '⚡' }}</div>
          <div class="skill-info">
            <h3 class="skill-name">{{ skill.nameZh || skill.name }}</h3>
            <span class="skill-type">{{ skill.skillType }}</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" :checked="skill.enabled" @change="toggleSkill(skill)" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <p class="skill-desc">{{ skill.description || 'No description' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { skillApi } from '@/api'
import type { Skill } from '@/types'

const { t } = useI18n()
const skills = ref<Skill[]>([])

async function fetchSkills() {
  try {
    const res: any = await skillApi.page({})
    skills.value = res.data?.records || []
  } catch (e) {
    console.error('Failed to fetch skills', e)
  }
}

async function toggleSkill(skill: Skill) {
  await skillApi.toggle(skill.id, !skill.enabled)
  skill.enabled = !skill.enabled
}

onMounted(() => {
  fetchSkills()
})
</script>

<style scoped>
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