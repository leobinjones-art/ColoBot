<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('contact.title') }}</h1>
        <p class="cb-page-desc">管理人脉关系</p>
      </div>
      <button class="btn-primary" @click="showCreateModal = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('contact.newContact') }}
      </button>
    </div>

    <!-- 搜索 -->
    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="搜索联系人..."
        @input="searchContacts"
      />
    </div>

    <!-- 联系人列表 -->
    <div class="contact-grid">
      <div v-for="contact in contacts" :key="contact.id" class="cb-card contact-card">
        <div class="contact-avatar">
          {{ contact.name?.charAt(0) || '?' }}
        </div>
        <div class="contact-info">
          <h3 class="contact-name">{{ contact.name }}</h3>
          <p v-if="contact.organization" class="contact-org">{{ contact.organization }}</p>
          <p v-if="contact.role" class="contact-role">{{ contact.role }}</p>
          <div class="contact-tags">
            <span v-for="tag in contact.tags?.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
        <div class="contact-actions">
          <a v-if="contact.email" :href="`mailto:${contact.email}`" class="action-link">📧</a>
          <a v-if="contact.phone" :href="`tel:${contact.phone}`" class="action-link">📞</a>
        </div>
      </div>
    </div>

    <div v-if="contacts.length === 0" class="empty-state">
      <p>暂无联系人，点击上方按钮添加</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { contactApi } from '@/api'
import type { Contact } from '@/types'

const { t } = useI18n()

const contacts = ref<Contact[]>([])
const searchQuery = ref('')
const showCreateModal = ref(false)

async function fetchContacts() {
  try {
    const res: any = await contactApi.list()
    contacts.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch contacts', e)
  }
}

async function searchContacts() {
  if (!searchQuery.value.trim()) {
    fetchContacts()
    return
  }
  try {
    const res: any = await contactApi.search(searchQuery.value)
    contacts.value = res.data || []
  } catch (e) {
    console.error('Failed to search contacts', e)
  }
}

onMounted(() => {
  fetchContacts()
})
</script>

<style scoped>
.search-bar {
  margin-bottom: 16px;
}

.search-bar input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-size: var(--cb-text-base);
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.contact-card {
  display: flex;
  gap: 12px;
  padding: 16px;
}

.contact-avatar {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  background: var(--cb-primary);
  color: white;
  border-radius: 50%;
  flex-shrink: 0;
}

.contact-info {
  flex: 1;
  min-width: 0;
}

.contact-name {
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.contact-org {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
}

.contact-role {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
  margin-bottom: 8px;
}

.contact-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag {
  padding: 2px 8px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-sm);
  font-size: var(--cb-text-xs);
  color: var(--cb-text-secondary);
}

.contact-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-link {
  font-size: 18px;
  text-decoration: none;
}

.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--cb-text-tertiary);
}
</style>