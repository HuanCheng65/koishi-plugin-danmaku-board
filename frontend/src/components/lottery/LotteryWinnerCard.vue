<script setup lang="ts">
import type { LotteryWinner } from '@shared/protocol';

const props = defineProps<{
  winner: LotteryWinner;
  index: number;
}>();
</script>

<template>
  <div
    class="flat-winner-card"
    :style="{ animationDelay: index * 0.1 + 's' }"
  >
    <div class="sq-avatar">
      <img :src="winner.avatar" onerror="this.style.opacity=0" />
    </div>
    <div class="sq-info">
      <div class="sq-name">{{ winner.name }}</div>
      <div class="sq-id">ID: {{ winner.id }}</div>
    </div>
  </div>
</template>

<style scoped>
.flat-winner-card {
  display: flex;
  align-items: center;
  margin-right: 30px;
  background: #1a1a1a;
  padding: 0 15px 0 0;
  height: 50px;
  opacity: 0;
  animation: slideInRight 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  border-left: 4px solid #ffd700;
}

.sq-avatar {
  width: 50px;
  height: 50px;
  background: #333;
  margin-right: 10px;
  overflow: hidden;
}
.sq-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sq-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.sq-name {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  font-family: "Microsoft YaHei", sans-serif;
  line-height: 1.2;
}
.sq-id {
  color: #888;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
