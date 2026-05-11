<script setup lang="ts">
import { useSocket } from '@/composables/useSocket';

const socket = useSocket();

function sendTestDanmaku() {
  socket.emit('send_danmaku', {
    content: [{ type: 'text', content: 'Hello' }],
  });
}
</script>

<template>
  <div class="dev-debug-bar">
    <button @click="sendTestDanmaku">Test</button>
  </div>
</template>

<style scoped>
.dev-debug-bar {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10001;
}
</style>
