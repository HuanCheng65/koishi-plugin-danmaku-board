<script setup lang="ts">
import type { QuizStatus, QuizOption } from '@shared/protocol';
import { QUIZ_OPTIONS } from '@/constants/quiz';

const props = defineProps<{
  status: QuizStatus;
  counts: Record<QuizOption, number>;
  correctAnswer: QuizOption | null;
  getPercent: (option: QuizOption) => number;
}>();
</script>

<template>
  <div class="stacked-chart-track">
    <div
      v-for="opt in QUIZ_OPTIONS"
      :key="opt"
      class="chart-segment"
      :class="[
        'seg-' + opt.toLowerCase(),
        {
          'is-dimmed': status === 'revealed' && correctAnswer !== opt,
          'is-winner': status === 'revealed' && correctAnswer === opt,
        },
      ]"
      :style="{ width: getPercent(opt) + '%' }"
    >
      <div
        class="seg-content"
        v-if="getPercent(opt) > 6 || (status === 'revealed' && correctAnswer === opt)"
      >
        <span class="seg-label">{{ opt }}</span>
        <span class="seg-data">{{ counts[opt] }}</span>
      </div>

      <transition name="bounce-in">
        <div v-if="status === 'revealed' && correctAnswer === opt" class="winner-check">
          ✓
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.stacked-chart-track {
  flex: 1;
  width: 100%;
  display: flex;
  background: #333;
  position: relative;
}
.chart-segment {
  height: 100%;
  transition: width 0.6s cubic-bezier(0.22, 0.61, 0.36, 1);
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding-left: 20px;
  border-right: 2px solid rgba(0, 0, 0, 0.2);
}
.chart-segment:last-child {
  border-right: none;
}
.seg-a { background: #ff3366; color: white; }
.seg-b { background: #00c2ff; color: black; }
.seg-c { background: #ffcc00; color: black; }
.seg-d { background: #66ff33; color: black; }
.seg-content {
  display: flex;
  flex-direction: column;
  white-space: nowrap;
  line-height: 1;
}
.seg-label {
  font-size: 32px;
  font-weight: 900;
}
.seg-data {
  font-size: 16px;
  font-weight: 700;
  opacity: 0.8;
  margin-top: 4px;
}
.chart-segment.is-dimmed {
  filter: grayscale(100%) brightness(0.4);
  background: #333 !important;
  color: #777 !important;
  transition: all 0.8s ease 0.3s;
}
.chart-segment.is-winner {
  z-index: 10;
  box-shadow: inset 0 0 0 6px #fff, 0 0 30px rgba(255, 255, 255, 0.5);
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.winner-check {
  position: absolute;
  right: 20px;
  top: 50%;
  margin-top: -24px;
  font-size: 48px;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
}
.bounce-in-enter-active {
  animation: bounceIn 0.6s cubic-bezier(0.215, 0.61, 0.355, 1);
}
@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  60% {
    opacity: 1;
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}
</style>
