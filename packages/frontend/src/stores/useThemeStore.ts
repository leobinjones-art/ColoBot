import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('system')

  function getSystemTheme(): 'light' | 'dark' {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  }

  function applyTheme(theme: 'light' | 'dark') {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }
  }

  function setMode(newMode: ThemeMode) {
    mode.value = newMode
    localStorage.setItem('theme', newMode)
    if (newMode === 'system') {
      applyTheme(getSystemTheme())
    } else {
      applyTheme(newMode)
    }
  }

  function init() {
    const stored = localStorage.getItem('theme') as ThemeMode | null
    if (stored) {
      mode.value = stored
    }
    const theme = mode.value === 'system' ? getSystemTheme() : mode.value
    applyTheme(theme)
  }

  // 监听系统主题变化
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (mode.value === 'system') {
        applyTheme(e.matches ? 'dark' : 'light')
      }
    })
  }

  watch(mode, (newMode) => {
    const theme = newMode === 'system' ? getSystemTheme() : newMode
    applyTheme(theme)
  })

  init()

  return { mode, setMode }
})