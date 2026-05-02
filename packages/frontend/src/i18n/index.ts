import { createI18n, ref } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

export const currentLocale = ref<'zh-CN' | 'en-US'>('zh-CN')

export const i18n = createI18n({
  legacy: false,
  locale: currentLocale.value,
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

export async function initializeLocale(): Promise<void> {
  const stored = localStorage.getItem('locale') as 'zh-CN' | 'en-US' | null
  if (stored && (stored === 'zh-CN' || stored === 'en-US')) {
    currentLocale.value = stored
    i18n.global.locale.value = stored
  }
}

export function setLocale(locale: 'zh-CN' | 'en-US'): void {
  currentLocale.value = locale
  i18n.global.locale.value = locale
  localStorage.setItem('locale', locale)
}