<script setup lang="ts">
import type { QuizStatus } from '@shared/protocol';

defineProps<{ status: QuizStatus }>();
</script>

<template>
  <transition name="text-slide" mode="out-in">
    <span v-if="status === 'active'" class="status-badge live">● LIVE</span>
    <span v-else-if="status === 'locked'" class="status-badge locked">🔒 LOCKED</span>
    <span v-else-if="status === 'revealed'" class="status-badge result">🎉 RESULT</span>
    <span v-else class="status-badge ready">READY</span>
  </transition>
</template>

<style scoped>
.status-badge.live {
  color: #ff3366;
  animation: blink 1s infinite;
}
.status-badge.locked {
  color: #ffcc00;
}
.status-badge.result {
  color: #00ccff;
}
@keyframes blink {
  50% {
    opacity: 0.5;
  }
}
.text-slide-enter-active,
.text-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.text-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.text-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
