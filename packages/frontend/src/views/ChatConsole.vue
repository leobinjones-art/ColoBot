<template>
  <div class="chat-layout">
    <!-- 会话侧边栏 -->
    <div class="conversation-panel" :class="{ 'mobile-open': convPanelOpen }">
      <div class="panel-header">
        <h2>{{ t('chat.conversations') }}</h2>
        <button class="new-chat-btn" @click="newConversation" :title="t('chat.newChat')">
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
        </button>
      </div>

      <div class="agent-selector">
        <select v-model="selectedAgentId">
          <option value="">{{ t('chat.selectAgent') }}</option>
          <option v-for="agent in agents" :key="agent.id" :value="agent.id">
            {{ agent.icon || '🤖' }} {{ agent.name }}
          </option>
        </select>
      </div>

      <div class="conversation-list">
        <div
          v-for="conv in conversations"
          :key="conv.conversationId"
          class="conv-item"
          :class="{ active: currentConversationId === conv.conversationId }"
          @click="selectConversation(conv)"
        >
          <div class="conv-info">
            <div class="conv-title">{{ conv.title }}</div>
            <div class="conv-meta">{{ conv.messageCount }} 条消息</div>
          </div>
        </div>

        <div v-if="conversations.length === 0" class="empty-convs">
          <p>{{ t('chat.newChat') }}</p>
        </div>
      </div>
    </div>

    <!-- 主聊天区域 -->
    <div class="chat-area">
      <!-- 消息列表 -->
      <div class="message-list" ref="messageListRef">
        <div v-for="msg in messages" :key="msg.id" class="message-wrapper" :class="msg.role">
          <div class="msg-avatar">
            <span v-if="msg.role === 'user'">👤</span>
            <span v-else>🤖</span>
          </div>
          <div class="msg-content">
            <!-- 流式进度 -->
            <StreamProgress
              v-if="msg.status === 'generating' && msg.metadata?.currentPhase"
              :phase="msg.metadata.currentPhase as any"
              :current-tool="currentToolName"
            />

            <!-- 工具调用 -->
            <div v-if="msg.metadata?.toolCalls?.length" class="tool-calls">
              <ToolCallCard
                v-for="(tool, idx) in msg.metadata.toolCalls"
                :key="idx"
                :tool-name="tool.name"
                :args="tool.arguments"
                :result="tool.result"
                :status="tool.status"
              />
            </div>

            <!-- 消息内容 -->
            <div class="msg-bubble">
              <div
                v-if="msg.role === 'assistant'"
                class="markdown-body"
                v-html="renderMarkdown(msg.content)"
              ></div>
              <template v-else>{{ msg.content }}</template>
              <span
                v-if="msg.status === 'generating' && !msg.metadata?.toolCalls?.length"
                class="typing-cursor"
              ></span>
            </div>
          </div>
        </div>

        <div v-if="messages.length === 0" class="empty-chat">
          <img src="/logo.svg" alt="ColoBot" class="empty-logo" />
          <h2>ColoBot</h2>
          <p>{{ t('chat.selectAgent') }}</p>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="chat-input-area">
        <textarea
          v-model="inputText"
          :placeholder="t('chat.inputPlaceholder')"
          @keydown.enter.exact.prevent="sendMessage"
          :disabled="isGenerating"
          rows="1"
        ></textarea>
        <div class="input-actions">
          <button v-if="isGenerating" class="stop-btn" @click="stopGeneration">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </button>
          <button v-else class="send-btn" :disabled="!canSend" @click="sendMessage">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAgentStore } from '@/stores/useAgentStore'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { conversationApi, userProfileApi } from '@/api'
import StreamProgress from '@/components/chat/StreamProgress.vue'
import ToolCallCard from '@/components/chat/ToolCallCard.vue'
import type { Conversation, Message, ToolCallMeta } from '@/types'

const { t } = useI18n()
const agentStore = useAgentStore()
const { renderMarkdown } = useMarkdownRenderer()

const agents = computed(() => agentStore.agents)
const selectedAgentId = ref<string | number | null>(null)
const conversations = ref<Conversation[]>([])
const currentConversationId = ref<string | null>(null)
const messages = ref<Message[]>([])
const inputText = ref('')
const isGenerating = ref(false)
const convPanelOpen = ref(false)
const messageListRef = ref<HTMLElement | null>(null)
const currentToolName = ref('')
const userProfileContext = ref<string>('')

let abortController: AbortController | null = null
let profileRefreshTimer: ReturnType<typeof setInterval> | null = null

const canSend = computed(() => {
  return inputText.value.trim() && selectedAgentId.value
})

function newConversation() {
  const id = 'conv-' + Date.now()
  conversations.value.unshift({
    conversationId: id,
    title: t('chat.newChat'),
    agentId: selectedAgentId.value || 0,
    messageCount: 0,
  })
  currentConversationId.value = id
  messages.value = []
}

function selectConversation(conv: Conversation) {
  currentConversationId.value = conv.conversationId
  loadMessages(conv.conversationId)
}

async function loadMessages(conversationId: string) {
  try {
    const res: any = await conversationApi.listMessages(conversationId)
    messages.value = res.data || []
  } catch (e) {
    console.error('Failed to load messages', e)
  }
}

async function sendMessage() {
  if (!canSend.value || isGenerating.value) return

  // 发送前刷新用户画像
  await loadUserProfileContext()

  const content = inputText.value.trim()
  inputText.value = ''

  // 添加用户消息
  const userMsg: Message = {
    id: Date.now().toString(),
    conversationId: currentConversationId.value || '',
    role: 'user',
    content,
    contentParts: [{ type: 'text', text: content }],
  }
  messages.value.push(userMsg)

  // 添加助手消息占位
  const assistantMsg: Message = {
    id: (Date.now() + 1).toString(),
    conversationId: currentConversationId.value || '',
    role: 'assistant',
    content: '',
    contentParts: [],
    status: 'generating',
    metadata: { currentPhase: 'thinking', toolCalls: [] },
  }
  messages.value.push(assistantMsg)

  isGenerating.value = true
  abortController = new AbortController()

  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        agentId: selectedAgentId.value,
        conversationId: currentConversationId.value,
        message: content,
        userContext: userProfileContext.value,
      }),
      signal: abortController.signal,
    })

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (reader) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            handleStreamEvent(data, assistantMsg)
          } catch {
            // ignore parse errors
          }
        }
      }

      await nextTick()
      scrollToBottom()
    }

    assistantMsg.status = 'completed'
    assistantMsg.metadata!.currentPhase = 'completed'
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      assistantMsg.status = 'failed'
    }
  } finally {
    isGenerating.value = false
    abortController = null
    currentToolName.value = ''
  }
}

function handleStreamEvent(data: any, msg: Message) {
  switch (data.type) {
    case 'content_delta':
      msg.content += data.content || data.delta || ''
      msg.metadata!.currentPhase = 'streaming'
      break
    case 'phase':
      msg.metadata!.currentPhase = data.phase
      break
    case 'thinking_delta':
      msg.metadata!.currentPhase = 'thinking'
      break
    case 'tool_call_started':
      msg.metadata!.currentPhase = 'executing_tool'
      currentToolName.value = data.tool_name || data.name || ''
      const toolCall: ToolCallMeta = {
        name: data.tool_name || data.name || '',
        arguments: data.arguments || '',
        status: 'running',
      }
      msg.metadata!.toolCalls!.push(toolCall)
      break
    case 'tool_call_completed':
      const calls = msg.metadata!.toolCalls!
      const lastCall = calls[calls.length - 1]
      if (lastCall) {
        lastCall.status = 'completed'
        lastCall.result = data.result || ''
      }
      currentToolName.value = ''
      break
    case 'tool_call_error':
      const errorCalls = msg.metadata!.toolCalls!
      const lastErrorCall = errorCalls[errorCalls.length - 1]
      if (lastErrorCall) {
        lastErrorCall.status = 'error'
        lastErrorCall.result = data.error || '执行失败'
      }
      currentToolName.value = ''
      break
    case 'awaiting_approval':
      const approvalCalls = msg.metadata!.toolCalls!
      const lastApprovalCall = approvalCalls[approvalCalls.length - 1]
      if (lastApprovalCall) {
        lastApprovalCall.status = 'awaiting_approval'
      }
      msg.status = 'awaiting_approval'
      break
    case 'done':
      msg.status = 'completed'
      msg.metadata!.currentPhase = 'completed'
      break
    case 'error':
      msg.status = 'failed'
      msg.metadata!.currentPhase = 'failed'
      break
  }
}

function stopGeneration() {
  abortController?.abort()
  isGenerating.value = false
}

function scrollToBottom() {
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

watch(
  messages,
  () => {
    nextTick(scrollToBottom)
  },
  { deep: true },
)

onMounted(() => {
  agentStore.fetchAgents()
  loadUserProfileContext()
  // 每5分钟刷新用户画像
  profileRefreshTimer = setInterval(loadUserProfileContext, 5 * 60 * 1000)
})

onUnmounted(() => {
  if (profileRefreshTimer) {
    clearInterval(profileRefreshTimer)
  }
})

async function loadUserProfileContext() {
  try {
    const res: any = await userProfileApi.get()
    userProfileContext.value = res.aiContext || ''
  } catch (e) {
    console.error('Failed to load user profile', e)
  }
}
</script>

<style scoped>
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--cb-border-light);
}

.panel-header h2 {
  font-size: var(--cb-text-lg);
  font-weight: 600;
  color: var(--cb-text-primary);
}

.new-chat-btn {
  padding: 8px;
  background: var(--cb-primary);
  color: white;
  border: none;
  border-radius: var(--cb-radius-md);
  cursor: pointer;
  transition: background 0.15s ease;
}

.new-chat-btn:hover {
  background: var(--cb-primary-hover);
}

.agent-selector {
  padding: 12px 16px;
  border-bottom: 1px solid var(--cb-border-light);
}

.agent-selector select {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-size: var(--cb-text-sm);
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
}

.conv-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--cb-border-light);
  cursor: pointer;
  transition: background 0.15s ease;
}

.conv-item:hover {
  background: var(--cb-sidebar-hover);
}

.conv-item.active {
  background: var(--cb-sidebar-active);
}

.conv-title {
  font-weight: 500;
  color: var(--cb-text-primary);
  margin-bottom: 4px;
}

.conv-meta {
  font-size: var(--cb-text-xs);
  color: var(--cb-text-tertiary);
}

.empty-convs {
  padding: 32px;
  text-align: center;
  color: var(--cb-text-tertiary);
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--cb-text-tertiary);
}

.empty-logo {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.message-wrapper {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.message-wrapper.user {
  flex-direction: row-reverse;
}

.msg-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.msg-content {
  max-width: 80%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.msg-bubble {
  padding: 12px 16px;
  border-radius: var(--cb-radius-lg);
  line-height: 1.6;
}

.message-wrapper.assistant .msg-bubble {
  background: var(--cb-assistant-bubble-bg);
  border: 1px solid var(--cb-assistant-bubble-border);
  color: var(--cb-text-primary);
}

.message-wrapper.user .msg-bubble {
  background: var(--cb-user-bubble-bg);
  color: var(--cb-user-bubble-color);
}

.tool-calls {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--cb-primary);
  margin-left: 2px;
  animation: blink 1s step-end infinite;
  vertical-align: text-bottom;
}

@keyframes blink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}

.message-wrapper {
  animation: fadeInUp 0.3s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chat-input-area {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--cb-border-light);
  background: var(--cb-bg-elevated);
}

.chat-input-area textarea {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius-md);
  background: var(--cb-bg);
  color: var(--cb-text-primary);
  font-family: inherit;
  font-size: var(--cb-text-base);
  resize: none;
  min-height: 44px;
  max-height: 200px;
}

.chat-input-area textarea:focus {
  outline: none;
  border-color: var(--cb-primary);
}

.chat-input-area textarea:disabled {
  opacity: 0.6;
}

.input-actions {
  display: flex;
  align-items: flex-end;
}

.send-btn,
.stop-btn {
  padding: 12px;
  border: none;
  border-radius: var(--cb-radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.send-btn {
  background: var(--cb-primary);
  color: white;
}

.send-btn:hover:not(:disabled) {
  background: var(--cb-primary-hover);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stop-btn {
  background: var(--cb-danger);
  color: white;
}

.stop-btn:hover {
  opacity: 0.9;
}
</style>
