<template>
  <Teleport to="body">
    <div v-if="visible" class="command-palette-overlay" @click.self="close">
      <div class="command-palette">
        <div class="search-input-wrapper">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="搜索命令或数据..."
            @keydown.down="selectNext"
            @keydown.up="selectPrev"
            @keydown.enter="executeSelected"
            @keydown.escape="close"
          />
          <span class="shortcut">ESC 关闭</span>
        </div>

        <div class="command-groups">
          <div v-for="group in filteredGroups" :key="group.name" class="command-group">
            <div class="group-title">{{ group.name }}</div>
            <div
              v-for="(cmd, idx) in group.commands"
              :key="cmd.id"
              class="command-item"
              :class="{ selected: selectedIndex === getGlobalIndex(group, idx) }"
              @click="execute(cmd)"
              @mouseenter="selectedIndex = getGlobalIndex(group, idx)"
            >
              <span class="command-icon">{{ cmd.icon }}</span>
              <span class="command-label">{{ cmd.label }}</span>
              <span class="command-shortcut">{{ cmd.shortcut }}</span>
            </div>
          </div>
        </div>

        <div class="command-footer">
          <span><kbd>↑↓</kbd> 导航</span>
          <span><kbd>Enter</kbd> 执行</span>
          <span><kbd>ESC</kbd> 关闭</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

interface Command {
  id: string
  label: string
  icon: string
  shortcut?: string
  action: () => void
}

interface CommandGroup {
  name: string
  commands: Command[]
}

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits(['close'])

const router = useRouter()
const inputRef = ref<HTMLInputElement>()
const query = ref('')
const selectedIndex = ref(0)

const commands: CommandGroup[] = [
  {
    name: '导航',
    commands: [
      { id: 'nav-chat', label: '对话', icon: '💬', shortcut: 'G C', action: () => router.push('/chat') },
      { id: 'nav-agents', label: 'Agent 管理', icon: '🤖', shortcut: 'G A', action: () => router.push('/agents') },
      { id: 'nav-skills', label: '技能', icon: '⚡', shortcut: 'G S', action: () => router.push('/skills') },
      { id: 'nav-sentinel', label: '安全守护', icon: '🛡️', shortcut: 'G W', action: () => router.push('/sentinel') },
    ]
  },
  {
    name: '助理',
    commands: [
      { id: 'nav-todos', label: '待办事项', icon: '✅', action: () => router.push('/assistant/todos') },
      { id: 'nav-calendar', label: '日程', icon: '📅', action: () => router.push('/assistant/calendar') },
      { id: 'nav-notes', label: '笔记', icon: '📝', action: () => router.push('/assistant/notes') },
      { id: 'nav-habits', label: '习惯', icon: '🎯', action: () => router.push('/assistant/habits') },
      { id: 'nav-goals', label: '目标', icon: '🏆', action: () => router.push('/assistant/goals') },
      { id: 'nav-contacts', label: '人脉', icon: '👥', action: () => router.push('/assistant/contacts') },
    ]
  },
  {
    name: '操作',
    commands: [
      { id: 'action-new-chat', label: '新建对话', icon: '➕', shortcut: '⌘N', action: () => emit('close') },
      { id: 'action-new-todo', label: '新建待办', icon: '✓', action: () => { router.push('/assistant/todos'); emit('close') } },
      { id: 'action-new-note', label: '新建笔记', icon: '📄', action: () => { router.push('/assistant/notes'); emit('close') } },
      { id: 'action-settings', label: '设置', icon: '⚙️', action: () => router.push('/settings/models') },
    ]
  },
  {
    name: '快捷指令',
    commands: [
      { id: 'cmd-translate', label: '/translate - 翻译文本', icon: '🌐', action: () => emit('close') },
      { id: 'cmd-summarize', label: '/summarize - 总结内容', icon: '📋', action: () => emit('close') },
      { id: 'cmd-explain', label: '/explain - 解释代码', icon: '💡', action: () => emit('close') },
      { id: 'cmd-fix', label: '/fix - 修复问题', icon: '🔧', action: () => emit('close') },
    ]
  }
]

const filteredGroups = computed(() => {
  if (!query.value.trim()) return commands

  return commands.map(group => ({
    name: group.name,
    commands: group.commands.filter(cmd =>
      cmd.label.toLowerCase().includes(query.value.toLowerCase())
    )
  })).filter(group => group.commands.length > 0)
})

const totalCommands = computed(() =>
  filteredGroups.value.reduce((sum, g) => sum + g.commands.length, 0)
)

function getGlobalIndex(group: CommandGroup, localIndex: number): number {
  let idx = 0
  for (const g of filteredGroups.value) {
    if (g === group) return idx + localIndex
    idx += g.commands.length
  }
  return 0
}

function selectNext() {
  if (selectedIndex.value < totalCommands.value - 1) {
    selectedIndex.value++
  }
}

function selectPrev() {
  if (selectedIndex.value > 0) {
    selectedIndex.value--
  }
}

function executeSelected() {
  let idx = 0
  for (const group of filteredGroups.value) {
    for (const cmd of group.commands) {
      if (idx === selectedIndex.value) {
        execute(cmd)
        return
      }
      idx++
    }
  }
}

function execute(cmd: Command) {
  cmd.action()
  close()
}

function close() {
  query.value = ''
  selectedIndex.value = 0
  emit('close')
}

watch(() => props.visible, (val) => {
  if (val) {
    setTimeout(() => inputRef.value?.focus(), 50)
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKey)
})

function handleGlobalKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    if (props.visible) {
      close()
    } else {
      // emit('open') - would need parent to handle
    }
  }
}
</script>

<style scoped>
.command-palette-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  z-index: 9999;
}

.command-palette {
  width: 90%;
  max-width: 560px;
  background: var(--cb-bg-elevated);
  border-radius: var(--cb-radius-lg);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--cb-border);
}

.search-input-wrapper svg {
  color: var(--cb-text-tertiary);
  flex-shrink: 0;
}

.search-input-wrapper input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 18px;
  color: var(--cb-text-primary);
  outline: none;
}

.search-input-wrapper input::placeholder {
  color: var(--cb-text-tertiary);
}

.shortcut {
  font-size: 12px;
  color: var(--cb-text-tertiary);
  padding: 4px 8px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-sm);
}

.command-groups {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px 0;
}

.command-group {
  padding: 8px 0;
}

.group-title {
  padding: 4px 20px;
  font-size: 12px;
  font-weight: 600;
  color: var(--cb-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.command-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  cursor: pointer;
  transition: background 0.1s ease;
}

.command-item:hover,
.command-item.selected {
  background: var(--cb-sidebar-hover);
}

.command-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.command-label {
  flex: 1;
  font-size: 14px;
  color: var(--cb-text-primary);
}

.command-shortcut {
  font-size: 12px;
  color: var(--cb-text-tertiary);
  font-family: monospace;
}

.command-footer {
  display: flex;
  gap: 16px;
  padding: 12px 20px;
  border-top: 1px solid var(--cb-border);
  background: var(--cb-bg-sunken);
  font-size: 12px;
  color: var(--cb-text-tertiary);
}

.command-footer kbd {
  padding: 2px 6px;
  background: var(--cb-bg);
  border-radius: 4px;
  font-family: inherit;
  margin-right: 4px;
}
</style>