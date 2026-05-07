<template>
  <div class="cb-page-shell">
    <div class="cb-page-header">
      <div>
        <h1 class="cb-page-title">{{ t('note.title') }}</h1>
        <p class="cb-page-desc">管理个人笔记</p>
      </div>
      <button class="btn-primary" @click="createNote">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {{ t('note.newNote') }}
      </button>
    </div>

    <!-- 搜索 -->
    <div class="search-bar">
      <input v-model="searchQuery" type="search" placeholder="搜索笔记..." @input="searchNotes" />
    </div>

    <!-- 笔记列表 -->
    <div class="note-grid">
      <div v-for="note in notes" :key="note.id" class="cb-card note-card" @click="editNote(note)">
        <h3 class="note-title">{{ note.title || '无标题' }}</h3>
        <p class="note-preview">{{ getPreview(note.content) }}</p>
        <div class="note-meta">
          <span class="note-date">{{ formatDate(note.updatedAt) }}</span>
          <div class="note-tags">
            <span v-for="tag in note.tags?.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="notes.length === 0" class="empty-state">
      <p>暂无笔记，点击上方按钮创建</p>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="editingNote" class="modal-overlay" @click.self="closeEditor">
      <div class="modal-content">
        <input v-model="editingNote.title" placeholder="标题" class="note-title-input" />
        <textarea
          v-model="editingNote.content"
          placeholder="内容..."
          class="note-content-input"
        ></textarea>
        <div class="form-group">
          <label>标签</label>
          <div class="tags-input">
            <span v-for="tag in editingNote.tags" :key="tag" class="tag-item">
              {{ tag }}
              <button type="button" class="tag-remove" @click="removeTag(tag)">×</button>
            </span>
            <input
              v-model="newTag"
              type="text"
              placeholder="添加标签..."
              @keydown.enter.prevent="addTag"
            />
          </div>
        </div>
        <div class="modal-actions">
          <button v-if="editingNote.id" type="button" class="btn-danger" @click="deleteNote">
            {{ t('common.delete') }}
          </button>
          <div class="actions-right">
            <button class="btn-secondary" @click="closeEditor">{{ t('common.cancel') }}</button>
            <button class="btn-primary" @click="saveNote">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { noteApi } from '@/api'
import type { Note } from '@/types'

const { t } = useI18n()

const notes = ref<Note[]>([])
const searchQuery = ref('')
const editingNote = ref<Note | null>(null)
const newTag = ref('')

function getPreview(content?: string): string {
  if (!content) return ''
  return content.slice(0, 150) + (content.length > 150 ? '...' : '')
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString()
}

async function fetchNotes() {
  try {
    const res: any = await noteApi.list()
    notes.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch notes', e)
  }
}

async function searchNotes() {
  if (!searchQuery.value.trim()) {
    fetchNotes()
    return
  }
  try {
    const res: any = await noteApi.search(searchQuery.value)
    notes.value = res.data || []
  } catch (e) {
    console.error('Failed to search notes', e)
  }
}

function createNote() {
  editingNote.value = {
    id: '',
    userId: '',
    title: '',
    content: '',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function editNote(note: Note) {
  editingNote.value = { ...note }
}

function closeEditor() {
  editingNote.value = null
  newTag.value = ''
}

function addTag() {
  if (!newTag.value.trim() || !editingNote.value) return
  if (!editingNote.value.tags) editingNote.value.tags = []
  if (!editingNote.value.tags.includes(newTag.value.trim())) {
    editingNote.value.tags.push(newTag.value.trim())
  }
  newTag.value = ''
}

function removeTag(tag: string) {
  if (!editingNote.value?.tags) return
  editingNote.value.tags = editingNote.value.tags.filter((t) => t !== tag)
}

async function saveNote() {
  if (!editingNote.value) return

  try {
    if (editingNote.value.id) {
      await noteApi.update(editingNote.value.id, editingNote.value)
    } else {
      await noteApi.create(editingNote.value)
    }
    closeEditor()
    fetchNotes()
  } catch (e) {
    console.error('Failed to save note', e)
  }
}

async function deleteNote() {
  if (!editingNote.value?.id || !confirm('确定要删除这个笔记吗？')) return
  try {
    await noteApi.delete(editingNote.value.id)
    closeEditor()
    fetchNotes()
  } catch (e) {
    console.error('Failed to delete note', e)
  }
}

onMounted(() => {
  fetchNotes()
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

.note-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.note-card {
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.note-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--cb-shadow-medium);
}

.note-title {
  font-size: var(--cb-text-base);
  font-weight: 600;
  color: var(--cb-text-primary);
  margin-bottom: 8px;
}

.note-preview {
  font-size: var(--cb-text-sm);
  color: var(--cb-text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
}

.note-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.note-date {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}

.note-tags {
  display: flex;
  gap: 4px;
}

.tag {
  padding: 2px 8px;
  background: var(--cb-primary-bg);
  color: var(--cb-primary);
  border-radius: var(--cb-radius-sm);
  font-size: var(--cb-text-xs);
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
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.note-title-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-size: var(--cb-text-lg);
  font-weight: 600;
  margin-bottom: 12px;
}

.note-content-input {
  flex: 1;
  min-height: 300px;
  padding: 12px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-family: var(--cb-font-mono);
  font-size: var(--cb-text-sm);
  resize: none;
  margin-bottom: 16px;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.actions-right {
  display: flex;
  gap: 12px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: var(--cb-text-sm);
  font-weight: 500;
  color: var(--cb-text-secondary);
  margin-bottom: 6px;
}

.tags-input {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
}

.tags-input input {
  flex: 1;
  min-width: 100px;
  border: none;
  background: transparent;
  color: var(--cb-text-primary);
  font-size: var(--cb-text-sm);
  outline: none;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--cb-primary-bg);
  color: var(--cb-primary);
  border-radius: var(--cb-radius-sm);
  font-size: var(--cb-text-xs);
}

.tag-remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  opacity: 0.6;
}

.tag-remove:hover {
  opacity: 1;
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
