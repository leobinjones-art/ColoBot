<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('nav.skills') }}</h1>
        <p class="cb-page-desc">开启 AI 的额外能力</p>
      </div>
    </div>

    <div class="skill-grid">
      <div v-for="skill in skills" :key="skill.id" class="cb-card skill-card">
        <div class="skill-header">
          <div class="skill-icon">{{ skill.icon || '⚡' }}</div>
          <div class="skill-info">
            <h3 class="skill-name">{{ skill.nameZh || skill.name }}</h3>
            <p class="skill-desc">{{ skill.description || 'AI 能力' }}</p>
          </div>
          <label class="toggle-switch" @click.stop>
            <input type="checkbox" :checked="skill.enabled" @change="toggleSkill(skill)" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <div v-if="skills.length === 0" class="empty-state">
      <div class="empty-icon">⚡</div>
      <p>暂无可用能力</p>
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
    skills.value = [
      { id: '1', name: 'morning_brief', nameZh: '晨间简报', icon: '🌅', enabled: true, description: '每天早上自动总结今日待办' },
      { id: '2', name: 'mood_check', nameZh: '心情关怀', icon: '💝', enabled: true, description: '连续低落时主动关心' },
      { id: '3', name: 'weekly_review', nameZh: '周报生成', icon: '📊', enabled: false, description: '每周日自动生成本周总结' },
      { id: '4', name: 'habit_reminder', nameZh: '习惯提醒', icon: '🎯', enabled: true, description: '习惯打卡时间自动提醒' },
      { id: '5', name: 'translate', nameZh: '翻译助手', icon: '🌐', enabled: true, description: '多语言翻译' },
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
  padding: 16px;
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 12px;
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

.skill-desc {
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
