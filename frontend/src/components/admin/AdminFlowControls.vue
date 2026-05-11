<script setup lang="ts">
import type { QuizStatus, AdminAction } from '@shared/protocol';

const props = defineProps<{
  status: QuizStatus;
}>();
const emit = defineEmits<{ action: [payload: AdminAction] }>();
</script>

<template>
  <div class="admin-group">
    <div class="label">2. 流程控制</div>
    <div class="btn-row">
      <button
        @click="emit('action', { action: 'start' })"
        :disabled="status === 'active'"
        class="btn-primary"
      >
        ▶ 开始
      </button>
      <button
        @click="emit('action', { action: 'stop' })"
        :disabled="status !== 'active'"
        class="btn-warning"
      >
        ⏸ 锁榜
      </button>
      <button @click="emit('action', { action: 'reset' })" class="btn-danger">
        🔄 关闭
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
}
.btn-primary {
  background: #007bff !important;
  color: white;
  border: none !important;
}
.btn-warning {
  background: #ffc107 !important;
  border: none !important;
}
.btn-danger {
  background: #dc3545 !important;
  color: white;
  border: none !important;
}
.btn-primary:disabled,
.btn-warning:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
