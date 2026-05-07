<template>
  <div class="stream-progress" :class="phase">
    <div class="progress-header">
      <span class="phase-icon">{{ phaseIcon }}</span>
      <span class="phase-label">{{ phaseLabel }}</span>
    </div>

    <div v-if="phase === 'thinking'" class="thinking-steps">
      <div
        v-for="(step, idx) in thinkingSteps"
        :key="idx"
        class="step-item"
        :class="{ active: idx <= currentStep }"
      >
        <span class="step-icon">{{ step.icon }}</span>
        <span class="step-text">{{ step.text }}</span>
        <span v-if="idx === currentStep" class="step-spinner"></span>
      </div>
    </div>

    <div v-if="phase === 'executing_tool'" class="tool-execution">
      <div class="tool-name">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-3.77 3.77a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-3.77 3.77"
          />
        </svg>
        {{ currentTool || '执行工具' }}
      </div>
      <div class="tool-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${toolProgress}%` }"></div>
        </div>
      </div>
    </div>

    <div v-if="phase === 'streaming'" class="streaming-indicator">
      <div class="typing-dots"><span></span><span></span><span></span></div>
      <span class="streaming-text">正在生成回复...</span>
    </div>

    <div v-if="elapsedTime > 0" class="elapsed-time">{{ elapsedTime.toFixed(1) }}s</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  phase: 'idle' | 'thinking' | 'executing_tool' | 'streaming' | 'completed' | 'failed'
  currentStep?: number
  currentTool?: string
  toolProgress?: number
  elapsedTime?: number
}

const props = withDefaults(defineProps<Props>(), {
  currentStep: 0,
  currentTool: '',
  toolProgress: 0,
  elapsedTime: 0,
})

const phaseIcon = computed(() => {
  switch (props.phase) {
    case 'thinking':
      return '🧠'
    case 'executing_tool':
      return '🔧'
    case 'streaming':
      return '✍️'
    case 'completed':
      return '✅'
    case 'failed':
      return '❌'
    default:
      return '⏳'
  }
})

const phaseLabel = computed(() => {
  switch (props.phase) {
    case 'thinking':
      return '深度思考'
    case 'executing_tool':
      return '执行工具'
    case 'streaming':
      return '生成回复'
    case 'completed':
      return '完成'
    case 'failed':
      return '失败'
    default:
      return '准备中'
  }
})

const thinkingSteps = [
  { icon: '📖', text: '读取上下文' },
  { icon: '🔍', text: '分析意图' },
  { icon: '🧠', text: '规划步骤' },
  { icon: '💡', text: '生成方案' },
]
</script>

<style scoped>
.stream-progress {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--cb-bg-sunken);
  border-radius: var(--cb-radius-md);
  font-size: 14px;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.phase-icon {
  font-size: 20px;
}

.phase-label {
  font-weight: 500;
  color: var(--cb-text-primary);
}

.thinking-steps {
  display: flex;
  gap: 16px;
  flex: 1;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.4;
  transition: opacity 0.2s ease;
}

.step-item.active {
  opacity: 1;
}

.step-icon {
  font-size: 14px;
}

.step-text {
  font-size: 12px;
  color: var(--cb-text-secondary);
}

.step-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--cb-primary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.tool-execution {
  flex: 1;
}

.tool-name {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--cb-text-secondary);
  margin-bottom: 8px;
}

.tool-progress {
  height: 4px;
}

.progress-bar {
  height: 100%;
  background: var(--cb-border);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--cb-primary);
  transition: width 0.2s ease;
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  background: var(--cb-primary);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.typing-dots span:nth-child(1) {
  animation-delay: -0.32s;
}
.typing-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.streaming-text {
  font-size: 12px;
  color: var(--cb-text-secondary);
}

.elapsed-time {
  font-size: 12px;
  color: var(--cb-text-tertiary);
  font-family: monospace;
}

.stream-progress.completed {
  background: rgba(90, 138, 90, 0.1);
}

.stream-progress.failed {
  background: rgba(192, 57, 43, 0.1);
}
</style>
