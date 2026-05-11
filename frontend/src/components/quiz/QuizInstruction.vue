<script setup lang="ts">
import type { QuizStatus, QuizOption } from '@shared/protocol';

defineProps<{
  status: QuizStatus;
  correctAnswer: QuizOption | null;
}>();
</script>

<template>
  <transition name="text-slide" mode="out-in">
    <div
      v-if="status === 'active' || status === 'idle'"
      key="tip-active"
      class="instruction-text"
    >
      发送弹幕 <span class="key-box">A</span>
      <span class="key-box">B</span> <span class="key-box">C</span>
      <span class="key-box">D</span> 抢答
    </div>
    <div v-else-if="status === 'locked'" key="tip-locked" class="instruction-text">
      ✋ 答题结束 · 等待揭晓
    </div>
    <div v-else key="tip-result" class="instruction-text">
      正确答案 <span class="key-box winner-key">{{ correctAnswer }}</span>
    </div>
  </transition>
</template>

<style scoped>
.instruction-text {
  font-family: "Microsoft YaHei", sans-serif;
  font-size: 15px;
  color: #ccc;
  white-space: nowrap;
}
.key-box {
  display: inline-block;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  padding: 0 6px;
  border-radius: 4px;
  font-family: "Impact", sans-serif;
  margin: 0 2px;
  line-height: 20px;
}
.key-box.winner-key {
  background: #ffd700;
  color: #000;
  padding: 0 8px;
  font-size: 16px;
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
