<template>
  <div class="tool-call-card" :class="status">
    <div class="tool-header" @click="expanded = !expanded">
      <div class="tool-info">
        <span class="tool-icon">{{ toolIcon }}</span>
        <span class="tool-name">{{ toolName }}</span>
        <span class="tool-status">{{ statusText }}</span>
      </div>
      <div class="tool-actions">
        <span v-if="duration" class="tool-duration">{{ duration }}ms</span>
        <svg
          class="expand-icon"
          :class="{ expanded }"
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
    </div>

    <Transition name="collapse">
      <div v-if="expanded" class="tool-details">
        <div v-if="args" class="detail-section">
          <div class="section-label">参数</div>
          <pre class="code-block">{{ formattedArgs }}</pre>
        </div>

        <div v-if="result" class="detail-section">
          <div class="section-label">结果</div>
          <pre class="code-block" :class="{ error: isError }">{{ formattedResult }}</pre>
        </div>

        <div v-if="status === 'awaiting_approval'" class="approval-actions">
          <button class="btn-approve" @click.stop="$emit('approve')">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            批准执行
          </button>
          <button class="btn-reject" @click.stop="$emit('reject')">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            拒绝
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  toolName: string
  args?: string
  result?: string
  status: 'running' | 'completed' | 'error' | 'awaiting_approval'
  duration?: number
}

const props = defineProps<Props>()
defineEmits(['approve', 'reject'])

const expanded = ref(true)

const toolIcon = computed(() => {
  const icons: Record<string, string> = {
    web_search: '🔍',
    read_file: '📄',
    write_file: '✏️',
    list_dir: '📁',
    delete_file: '🗑️',
    shell: '💻',
    python: '🐍',
    http: '🌐',
    json_parse: '📊',
    calculate: '🔢',
  }
  return icons[props.toolName] || '🔧'
})

const statusText = computed(() => {
  switch (props.status) {
    case 'running':
      return '执行中...'
    case 'completed':
      return '完成'
    case 'error':
      return '失败'
    case 'awaiting_approval':
      return '等待审批'
    default:
      return ''
  }
})

const isError = computed(() => props.status === 'error')

const formattedArgs = computed(() => {
  if (!props.args) return ''
  try {
    return JSON.stringify(JSON.parse(props.args), null, 2)
  } catch {
    return props.args
  }
})

const formattedResult = computed(() => {
  if (!props.result) return ''
  try {
    return JSON.stringify(JSON.parse(props.result), null, 2)
  } catch {
    return props.result
  }
})
</script>

<style scoped>
.tool-call-card {
  margin: 8px 0;
  border-radius: var(--cb-radius-md);
  border: 1px solid var(--cb-border);
  overflow: hidden;
}

.tool-call-card.running {
  border-color: var(--cb-primary);
}

.tool-call-card.completed {
  border-color: var(--cb-success);
}

.tool-call-card.error {
  border-color: var(--cb-danger);
}

.tool-call-card.awaiting_approval {
  border-color: var(--cb-warning);
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--cb-bg-sunken);
  cursor: pointer;
}

.tool-header:hover {
  background: var(--cb-sidebar-hover);
}

.tool-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-icon {
  font-size: 16px;
}

.tool-name {
  font-weight: 500;
  color: var(--cb-text-primary);
  font-family: monospace;
}

.tool-status {
  font-size: 12px;
  color: var(--cb-text-tertiary);
}

.tool-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-duration {
  font-size: 12px;
  color: var(--cb-text-tertiary);
  font-family: monospace;
}

.expand-icon {
  color: var(--cb-text-tertiary);
  transition: transform 0.2s ease;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.tool-details {
  padding: 12px;
  border-top: 1px solid var(--cb-border);
}

.detail-section {
  margin-bottom: 12px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.section-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--cb-text-tertiary);
  margin-bottom: 6px;
}

.code-block {
  margin: 0;
  padding: 10px;
  background: var(--cb-bg);
  border-radius: var(--cb-radius-sm);
  font-family: monospace;
  font-size: 12px;
  color: var(--cb-text-primary);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.code-block.error {
  color: var(--cb-danger);
  background: rgba(239, 68, 68, 0.1);
}

.approval-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.btn-approve,
.btn-reject {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: none;
  border-radius: var(--cb-radius-md);
  cursor: pointer;
  font-size: 14px;
}

.btn-approve {
  background: var(--cb-success);
  color: white;
}

.btn-approve:hover {
  opacity: 0.9;
}

.btn-reject {
  background: var(--cb-bg-sunken);
  border: 1px solid var(--cb-border);
  color: var(--cb-text-secondary);
}

.btn-reject:hover {
  background: var(--cb-danger);
  border-color: var(--cb-danger);
  color: white;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 500px;
}
</style>
