<script setup lang="ts">
const props = defineProps<{
  duration: number;
  running: boolean;
  restartKey: number;
}>();
</script>

<template>
  <div
    class="timer-border"
    :class="{ running }"
    :style="{ animationDuration: duration + 's' }"
    :key="restartKey"
  ></div>
</template>

<style scoped>
.timer-border {
  height: 6px;
  width: 100%;
  background: #ffffff;
  transform-origin: center;
  transform: scaleX(1);
}
.timer-border.running {
  animation: shrinkCenter linear forwards;
}
@keyframes shrinkCenter {
  from {
    transform: scaleX(1);
    background: #00ffaa;
  }
  50% {
    background: #ffee00;
  }
  to {
    transform: scaleX(0);
    background: #ff0044;
  }
}
</style>
