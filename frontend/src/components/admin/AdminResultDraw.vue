<script setup lang="ts">
import { ref } from 'vue';
import type { QuizStatus, AdminAction } from '@shared/protocol';
import { QUIZ_OPTIONS } from '@/constants/quiz';

const props = defineProps<{
  status: QuizStatus;
}>();
const emit = defineEmits<{ action: [payload: AdminAction] }>();

const drawCount = ref<number>(1);
</script>

<template>
  <div class="admin-group">
    <div class="label">3. 结果 & 抽奖</div>
    <div class="btn-row" style="margin-bottom: 8px">
      <button
        v-for="opt in QUIZ_OPTIONS"
        :key="opt"
        @click="emit('action', { action: 'answer', arg: opt })"
      >
        {{ opt }}
      </button>
    </div>
    <div class="label">幸运抽奖</div>
    <div class="btn-row">
      <input type="number" v-model="drawCount" min="1" class="admin-input" />
      <button
        @click="emit('action', { action: 'draw', arg: drawCount })"
        :disabled="status !== 'revealed'"
        class="btn-gold"
      >
        🎲 抽取 {{ drawCount }} 人
      </button>
    </div>
  </div>
</template>

<style scoped>
.admin-group {
  margin-bottom: 15px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
.admin-group:last-child {
  border-bottom: none;
}
.label {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
  font-weight: bold;
}
.btn-row {
  display: flex;
  gap: 5px;
}
button {
  flex: 1;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  background: #f9f9f9;
}
.admin-input {
  width: 50px;
  text-align: center;
  border: 1px solid #ddd;
  border-radius: 4px;
}
.btn-gold {
  background: linear-gradient(to bottom, #ffd700, #ffaa00) !important;
  color: black !important;
  border: none !important;
  font-weight: bold;
}
.btn-gold:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
