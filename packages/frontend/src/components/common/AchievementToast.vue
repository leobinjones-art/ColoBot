<template>
  <Teleport to="body">
    <Transition name="achievement">
      <div v-if="visible" class="achievement-overlay" @click.self="close">
        <div class="achievement-card">
          <div class="achievement-glow"></div>
          <div class="achievement-icon">{{ achievement.icon }}</div>
          <div class="achievement-content">
            <div class="achievement-title">{{ achievement.title }}</div>
            <div class="achievement-desc">{{ achievement.description }}</div>
          </div>
          <div class="achievement-sparkles">
            <span v-for="i in 12" :key="i" class="sparkle" :style="sparkleStyle(i)"></span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Achievement {
  icon: string
  title: string
  description: string
}

const props = defineProps<{
  visible: boolean
  achievement: Achievement
}>()

const emit = defineEmits(['close'])

function sparkleStyle(index: number) {
  const angle = (index / 12) * 360
  const distance = 80 + Math.random() * 40
  const x = Math.cos((angle * Math.PI) / 180) * distance
  const y = Math.sin((angle * Math.PI) / 180) * distance
  return {
    transform: `translate(${x}px, ${y}px)`,
    animationDelay: `${index * 0.05}s`,
  }
}

function close() {
  emit('close')
}
</script>

<style scoped>
.achievement-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.achievement-card {
  position: relative;
  width: 320px;
  padding: 32px;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  border: 2px solid #ffd700;
  border-radius: 16px;
  text-align: center;
  overflow: hidden;
}

.achievement-glow {
  position: absolute;
  inset: -50%;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%);
  animation: rotate 4s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.achievement-icon {
  position: relative;
  font-size: 64px;
  margin-bottom: 16px;
  animation: bounce 0.6s ease-out;
}

@keyframes bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.achievement-title {
  position: relative;
  font-size: 24px;
  font-weight: 700;
  color: #ffd700;
  margin-bottom: 8px;
}

.achievement-desc {
  position: relative;
  font-size: 14px;
  color: #a0a0a0;
}

.achievement-sparkles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.sparkle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  background: #ffd700;
  border-radius: 50%;
  animation: sparkle 1s ease-out forwards;
  opacity: 0;
}

@keyframes sparkle {
  0% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0);
  }
}

.achievement-enter-active {
  animation: fadeIn 0.3s ease-out;
}

.achievement-leave-active {
  animation: fadeOut 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.8);
  }
}
</style>
