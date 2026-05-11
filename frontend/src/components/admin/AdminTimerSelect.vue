<script setup lang="ts">
import { TIMER_PRESETS } from '@/constants/quiz';

const props = defineProps<{ duration: number }>();
const emit = defineEmits<{ 'update:duration': [value: number] }>();
</script>

<template>
  <div class="admin-group">
    <div class="label">1. 倒计时显示</div>
    <div class="btn-row">
      <button
        v-for="preset in TIMER_PRESETS"
        :key="preset"
        @click="emit('update:duration', preset)"
        :class="{ active: duration === preset }"
      >
        {{ preset }}s
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
button.active {
  background: #333;
  color: white;
}
</style>
