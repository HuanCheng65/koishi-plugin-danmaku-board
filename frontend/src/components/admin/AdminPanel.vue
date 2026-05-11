<script setup lang="ts">
import { useQuiz } from '@/composables/useQuiz';
import AdminTimerSelect from './AdminTimerSelect.vue';
import AdminFlowControls from './AdminFlowControls.vue';
import AdminResultDraw from './AdminResultDraw.vue';

const { status, timerDuration, sendAdmin } = useQuiz();

function onTimerDurationUpdate(v: number) {
  timerDuration.value = v;
}
</script>

<template>
  <div class="admin-panel">
    <h3>📺 场控台</h3>

    <AdminTimerSelect
      :duration="timerDuration"
      @update:duration="onTimerDurationUpdate"
    />

    <AdminFlowControls :status="status" @action="sendAdmin" />

    <AdminResultDraw :status="status" @action="sendAdmin" />
  </div>
</template>

<style scoped>
.admin-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #fff;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
  width: 220px;
  font-family: "Microsoft YaHei", sans-serif;
  z-index: 10000;
}
.admin-panel h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
}
</style>
