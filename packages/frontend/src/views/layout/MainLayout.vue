<template>
  <div class="app-layout">
    <!-- 移动端遮罩 -->
    <Transition name="fade">
      <div v-if="isMobile && mobileMenuOpen" class="sidebar-backdrop" @click="mobileMenuOpen = false"></div>
    </Transition>

    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed && !isMobile, 'mobile-open': mobileMenuOpen }">
      <!-- Logo -->
      <div class="sidebar-logo">
        <img src="/logo.svg" alt="ColoBot" />
        <div v-if="!sidebarCollapsed || isMobile" class="logo-text">
          <span class="logo-name">ColoBot</span>
        </div>
        <button class="collapse-btn" @click="toggleSidebar">
          <svg v-if="!sidebarCollapsed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <!-- 导航菜单 -->
      <nav class="sidebar-nav">
        <div class="nav-group">
          <div v-if="!sidebarCollapsed" class="nav-group-title">{{ t('nav.chat') }}</div>
          <router-link to="/chat" class="nav-item" @click="onNavClick">
            <span class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('nav.chat') }}</span>
          </router-link>
        </div>

        <div class="nav-group">
          <div v-if="!sidebarCollapsed" class="nav-group-title">{{ t('nav.agents') }}</div>
          <router-link to="/agents" class="nav-item" @click="onNavClick">
            <span class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('nav.agents') }}</span>
          </router-link>
          <router-link to="/skills" class="nav-item" @click="onNavClick">
            <span class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('nav.skills') }}</span>
          </router-link>
        </div>

        <div class="nav-group">
          <div v-if="!sidebarCollapsed" class="nav-group-title">{{ t('nav.sentinel') }}</div>
          <router-link to="/sentinel" class="nav-item" @click="onNavClick">
            <span class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('nav.sentinel') }}</span>
          </router-link>
        </div>

        <div class="nav-group">
          <div v-if="!sidebarCollapsed" class="nav-group-title">{{ t('nav.assistant') }}</div>
          <router-link to="/assistant/todos" class="nav-item" @click="onNavClick">
            <span class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('assistant.todos') }}</span>
          </router-link>
          <router-link to="/assistant/calendar" class="nav-item" @click="onNavClick">
            <span class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('assistant.calendar') }}</span>
          </router-link>
          <router-link to="/assistant/notes" class="nav-item" @click="onNavClick">
            <span class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('assistant.notes') }}</span>
          </router-link>
          <router-link to="/assistant/habits" class="nav-item" @click="onNavClick">
            <span class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('assistant.habits') }}</span>
          </router-link>
        </div>

        <div class="nav-group">
          <div v-if="!sidebarCollapsed" class="nav-group-title">{{ t('nav.settings') }}</div>
          <router-link to="/settings/models" class="nav-item" @click="onNavClick">
            <span class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </span>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ t('nav.settings') }}</span>
          </router-link>
        </div>
      </nav>

      <!-- 底部 -->
      <div class="sidebar-footer">
        <button class="logout-btn" @click="logout" :title="t('nav.logout')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span v-if="!sidebarCollapsed">{{ t('nav.logout') }}</span>
        </button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { handleAuthFailure } from '@/utils/auth'

const { t } = useI18n()
const router = useRouter()

const sidebarCollapsed = ref(false)
const mobileMenuOpen = ref(false)
const windowWidth = ref(window.innerWidth)

const isMobile = computed(() => windowWidth.value < 768)

function toggleSidebar() {
  if (isMobile.value) {
    mobileMenuOpen.value = !mobileMenuOpen.value
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
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

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
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
</style>