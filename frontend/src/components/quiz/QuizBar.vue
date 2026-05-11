<script setup lang="ts">
import { useQuiz } from '@/composables/useQuiz';
import QuizTimer from './QuizTimer.vue';
import QuizStatusBadge from './QuizStatusBadge.vue';
import QuizInstruction from './QuizInstruction.vue';
import QuizChart from './QuizChart.vue';

const props = defineProps<{
  adminView: boolean;
}>();

const {
  status,
  counts,
  total,
  correctAnswer,
  timerDuration,
  timerKey,
  visible,
  getPercent,
} = useQuiz();
</script>

<template>
  <transition name="slide-up">
    <div
      v-if="visible || adminView"
      class="flat-quiz-bar"
      :class="{ 'admin-view': adminView }"
    >
      <QuizTimer
        :duration="timerDuration"
        :running="status === 'active'"
        :restart-key="timerKey"
      />

      <div class="bar-info-grid">
        <div class="grid-left">
          <QuizStatusBadge :status="status" />
        </div>

        <div class="grid-center">
          <QuizInstruction :status="status" :correct-answer="correctAnswer" />
        </div>

        <div class="grid-right total-text">
          VOTES: <b>{{ total }}</b>
        </div>
      </div>

      <QuizChart
        :status="status"
        :counts="counts"
        :correct-answer="correctAnswer"
        :get-percent="getPercent"
      />
    </div>
  </transition>
</template>

<style scoped>
.flat-quiz-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 120px;
  z-index: 9999;
  background: #000000;
  display: flex;
  flex-direction: column;
  font-family: "Montserrat", "Impact", "Arial Black", sans-serif;
}
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(120%);
}

.bar-info-grid {
  height: 36px;
  display: grid;
  grid-template-columns: 120px 1fr 120px;
  align-items: center;
  padding: 0 20px;
  background: #1a1a1a;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  overflow: hidden;
}
.grid-left { text-align: left; }
.grid-center {
  text-align: center;
  display: flex;
  justify-content: center;
}
.grid-right { text-align: right; }
.total-text b {
  color: #ffd700;
}

.flat-quiz-bar.admin-view {
  transform-origin: bottom left;
  transform: scale(0.6) !important;
  bottom: 20px;
  left: 20px;
  width: 800px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}
</style>
