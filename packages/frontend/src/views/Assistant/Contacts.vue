<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('contact.title') }}</h1>
        <p class="cb-page-desc">管理人脉关系</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
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
        <div class="contact-info" @click="openEditModal(contact)">
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
          <button class="delete-btn" @click="confirmDelete(contact)">🗑</button>
        </div>
      </div>
    </div>

    <div v-if="contacts.length === 0" class="empty-state">
      <p>暂无联系人，点击上方按钮添加</p>
    </div>

    <!-- 创建/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h2>{{ editingContact ? '编辑联系人' : t('contact.newContact') }}</h2>
        <form @submit.prevent="saveContact">
          <div class="form-group">
            <label>{{ t('contact.name') }}</label>
            <input v-model="form.name" type="text" required placeholder="输入姓名" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>{{ t('contact.organization') }}</label>
              <input v-model="form.organization" type="text" placeholder="公司/组织" />
            </div>
            <div class="form-group">
              <label>{{ t('contact.role') }}</label>
              <input v-model="form.role" type="text" placeholder="职位" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>{{ t('contact.email') }}</label>
              <input v-model="form.email" type="email" placeholder="邮箱" />
            </div>
            <div class="form-group">
              <label>{{ t('contact.phone') }}</label>
              <input v-model="form.phone" type="tel" placeholder="电话" />
            </div>
          </div>
          <div class="form-group">
            <label>{{ t('contact.tags') }}</label>
            <input v-model="form.tagsInput" type="text" placeholder="标签，用逗号分隔" />
          </div>
          <div class="form-group">
            <label>{{ t('contact.note') }}</label>
            <textarea v-model="form.note" rows="3" placeholder="备注"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="closeModal">{{ t('common.cancel') }}</button>
            <button type="submit" class="btn-primary">{{ t('common.save') }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal-content confirm-modal">
        <h2>{{ t('common.confirmDelete') }}</h2>
        <p>确定要删除「{{ deletingContact?.name }}」吗？</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showDeleteConfirm = false">{{ t('common.cancel') }}</button>
          <button class="btn-danger" @click="deleteContact">{{ t('common.delete') }}</button>
        </div>
      </div>
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
const showModal = ref(false)
const showDeleteConfirm = ref(false)
const editingContact = ref<Contact | null>(null)
const deletingContact = ref<Contact | null>(null)
const searchQuery = ref('')

const form = ref({
  name: '',
  organization: '',
  role: '',
  email: '',
  phone: '',
  tagsInput: '',
  note: ''
})

function openCreateModal() {
  editingContact.value = null
  form.value = { name: '', organization: '', role: '', email: '', phone: '', tagsInput: '', note: '' }
  showModal.value = true
}

function openEditModal(contact: Contact) {
  editingContact.value = contact
  form.value = {
    name: contact.name,
    organization: contact.organization || '',
    role: contact.role || '',
    email: contact.email || '',
    phone: contact.phone || '',
    tagsInput: contact.tags?.join(', ') || '',
    note: contact.note || ''
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingContact.value = null
}

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

async function saveContact() {
  try {
    const tags = form.value.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    const data = { ...form.value, tags }
    if (editingContact.value) {
      await contactApi.update(editingContact.value.id, data)
      contacts.value = contacts.value.map(c => c.id === editingContact.value!.id ? { ...c, ...data } : c)
    } else {
      const res: any = await contactApi.create(data)
      contacts.value.push(res.data)
    }
    closeModal()
  } catch (e) {
    console.error('Failed to save contact', e)
  }
}

function confirmDelete(contact: Contact) {
  deletingContact.value = contact
  showDeleteConfirm.value = true
}

async function deleteContact() {
  if (!deletingContact.value) return
  try {
    await contactApi.delete(deletingContact.value.id)
    contacts.value = contacts.value.filter(c => c.id !== deletingContact.value!.id)
    showDeleteConfirm.value = false
    deletingContact.value = null
  } catch (e) {
    console.error('Failed to delete contact', e)
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
  cursor: pointer;
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
  align-items: center;
}

.action-link {
  font-size: 18px;
  text-decoration: none;
}

.delete-btn {
  padding: 4px;
  background: transparent;
  border: none;
  font-size: 14px;
  cursor: pointer;
}

.delete-btn:hover {
  color: var(--cb-danger);
}

.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--cb-text-tertiary);
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
  max-width: 500px;
}

.modal-content h2 {
  font-size: var(--cb-text-lg);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 20px;
}

.confirm-modal {
  max-width: 400px;
}

.confirm-modal p {
  color: var(--cb-text-secondary);
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
  background: var(--cb-danger);
  border: none;
  border-radius: var(--cb-radius-md);
  color: white;
  cursor: pointer;
}
</style>