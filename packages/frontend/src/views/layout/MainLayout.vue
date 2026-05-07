<template>
  <div class="app-layout">
    <!-- 移动端遮罩 -->
    <Transition name="fade">
      <div
        v-if="isMobile && mobileMenuOpen"
        class="sidebar-backdrop"
        @click="mobileMenuOpen = false"
      ></div>
    </Transition>

    <!-- 侧边栏 -->
    <aside
      class="sidebar"
      :class="{ collapsed: sidebarCollapsed && !isMobile, 'mobile-open': mobileMenuOpen }"
    >
      <!-- Logo -->
      <div class="sidebar-logo">
        <img src="/logo.svg" alt="NexusMind" />
        <div v-if="!sidebarCollapsed || isMobile" class="logo-text">
          <span class="logo-name">NexusMind</span>
        </div>
        <button class="collapse-btn" @click="toggleSidebar">
          <svg
            v-if="!sidebarCollapsed"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <svg
            v-else
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <!-- 搜索按钮 -->
      <div
        v-if="!sidebarCollapsed || isMobile"
        class="search-trigger"
        @click="showCommandPalette = true"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>搜索命令...</span>
        <kbd>⌘K</kbd>
      </div>

      <!-- 导航菜单 -->
      <nav class="sidebar-nav">
        <!-- 今日 - 常显 -->
        <div class="nav-group">
          <router-link to="/home" class="nav-item" @click="onNavClick">
            <span class="nav-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('nav.myDay') }}</span>
          </router-link>
        </div>

        <!-- 对话 - 常显 -->
        <div class="nav-group">
          <router-link to="/chat" class="nav-item" @click="onNavClick">
            <span class="nav-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('nav.chat') }}</span>
          </router-link>
        </div>

        <!-- 我的日常 - 折叠 -->
        <div class="nav-group collapsible" :class="{ expanded: expandedGroups.assistant }">
          <div class="nav-group-header" @click="toggleGroup('assistant')">
            <span class="nav-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('nav.assistant') }}</span>
            <svg
              v-if="!sidebarCollapsed"
              class="expand-icon"
              :class="{ rotated: expandedGroups.assistant }"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <div v-if="expandedGroups.assistant && !sidebarCollapsed" class="nav-group-items">
            <router-link to="/assistant/todos" class="nav-item sub-item" @click="onNavClick">
              <span class="nav-label">{{ t('assistant.todos') }}</span>
            </router-link>
            <router-link to="/assistant/habits" class="nav-item sub-item" @click="onNavClick">
              <span class="nav-label">{{ t('assistant.habits') }}</span>
            </router-link>
            <router-link to="/assistant/moods" class="nav-item sub-item" @click="onNavClick">
              <span class="nav-label">{{ t('assistant.moods') }}</span>
            </router-link>
            <router-link to="/assistant/calendar" class="nav-item sub-item" @click="onNavClick">
              <span class="nav-label">{{ t('assistant.calendar') }}</span>
            </router-link>
            <router-link to="/assistant/notes" class="nav-item sub-item" @click="onNavClick">
              <span class="nav-label">{{ t('assistant.notes') }}</span>
            </router-link>
            <router-link to="/assistant/goals" class="nav-item sub-item" @click="onNavClick">
              <span class="nav-label">{{ t('assistant.goals') }}</span>
            </router-link>
            <router-link to="/assistant/finances" class="nav-item sub-item" @click="onNavClick">
              <span class="nav-label">{{ t('assistant.finances') }}</span>
            </router-link>
            <router-link to="/assistant/contacts" class="nav-item sub-item" @click="onNavClick">
              <span class="nav-label">{{ t('assistant.contacts') }}</span>
            </router-link>
          </div>
        </div>

        <!-- 设置 - 常显 -->
        <div class="nav-group">
          <router-link to="/settings" class="nav-item" @click="onNavClick">
            <span class="nav-icon">
              <svg
                width="20"
                height="20"
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
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('nav.settings') }}</span>
          </router-link>
        </div>

        <!-- 高级 - 折叠 -->
        <div class="nav-group collapsible" :class="{ expanded: expandedGroups.advanced }">
          <div class="nav-group-header" @click="toggleGroup('advanced')">
            <span class="nav-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('nav.advanced') }}</span>
            <svg
              v-if="!sidebarCollapsed"
              class="expand-icon"
              :class="{ rotated: expandedGroups.advanced }"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <div v-if="expandedGroups.advanced && !sidebarCollapsed" class="nav-group-items">
            <router-link to="/agents" class="nav-item sub-item" @click="onNavClick">
              <span class="nav-label">{{ t('nav.agents') }}</span>
            </router-link>
            <router-link to="/skills" class="nav-item sub-item" @click="onNavClick">
              <span class="nav-label">{{ t('nav.skills') }}</span>
            </router-link>
            <router-link to="/sentinel" class="nav-item sub-item" @click="onNavClick">
              <span class="nav-label">{{ t('nav.sentinel') }}</span>
            </router-link>
            <router-link to="/charter" class="nav-item sub-item" @click="onNavClick">
              <span class="nav-label">{{ t('charter.title') }}</span>
            </router-link>
          </div>
        </div>
      </nav>

      <!-- 底部 -->
      <div class="sidebar-footer">
        <button class="logout-btn" @click="logout" :title="t('nav.logout')">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span v-if="!sidebarCollapsed">{{ t('nav.logout') }}</span>
        </button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <router-view />
    </main>

    <!-- 命令面板 -->
    <CommandPalette :visible="showCommandPalette" @close="showCommandPalette = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { handleAuthFailure } from '@/utils/auth'
import CommandPalette from '@/components/common/CommandPalette.vue'

const { t } = useI18n()
const router = useRouter()

const sidebarCollapsed = ref(false)
const mobileMenuOpen = ref(false)
const windowWidth = ref(window.innerWidth)
const showCommandPalette = ref(false)
const expandedGroups = ref({
  assistant: false,
  advanced: false,
})

const isMobile = computed(() => windowWidth.value < 768)

function toggleSidebar() {
  if (isMobile.value) {
    mobileMenuOpen.value = !mobileMenuOpen.value
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
}

function toggleGroup(group: 'assistant' | 'advanced') {
  expandedGroups.value[group] = !expandedGroups.value[group]
}

function onNavClick() {
  if (isMobile.value) {
    mobileMenuOpen.value = false
  }
}

function logout() {
  handleAuthFailure()
}

function handleResize() {
  windowWidth.value = window.innerWidth
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    showCommandPalette.value = !showCommandPalette.value
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--cb-sidebar-border);
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: var(--cb-radius-md);
  color: var(--cb-sidebar-text);
  font-size: var(--cb-text-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.logout-btn:hover {
  background: var(--cb-sidebar-hover);
  color: var(--cb-danger);
}

.collapse-btn {
  margin-left: auto;
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: var(--cb-radius-sm);
  color: var(--cb-text-secondary);
  cursor: pointer;
}

.collapse-btn:hover {
  background: var(--cb-bg-sunken);
}

.search-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 12px 16px;
  padding: 8px 12px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
  color: var(--cb-text-tertiary);
  font-size: var(--cb-text-sm);
  cursor: pointer;
  transition: background 0.15s ease;
}

.search-trigger:hover {
  background: var(--cb-sidebar-hover);
}

.search-trigger svg {
  opacity: 0.6;
}

.search-trigger span {
  flex: 1;
}

.search-trigger kbd {
  padding: 2px 6px;
  background: var(--cb-bg);
  border-radius: 4px;
  font-size: 11px;
  font-family: inherit;
}

.nav-group.collapsible .nav-group-header {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.nav-group.collapsible .nav-group-header:hover {
  background: var(--cb-sidebar-hover);
}

.expand-icon {
  margin-left: auto;
  transition: transform 0.2s ease;
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

.nav-group-items {
  padding-left: 36px;
}

.nav-item.sub-item {
  padding: 8px 16px;
}

.nav-item.sub-item .nav-label {
  font-size: var(--cb-text-sm);
}
</style>
