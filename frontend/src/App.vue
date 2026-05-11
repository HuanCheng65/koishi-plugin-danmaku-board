<script setup lang="ts">
import { ref } from "vue";
import { useQuiz } from "@/composables/useQuiz";
import { useAdminRole } from "@/composables/useAdminRole";
import { QUIZ_OPTIONS } from "@/constants/quiz";
import DevDebugBar from "@/components/DevDebugBar.vue";
import DanmakuLayer from "@/components/DanmakuLayer.vue";
import LotteryBar from '@/components/lottery/LotteryBar.vue';
import QuizBar from '@/components/quiz/QuizBar.vue';

const { sendAdmin, timerDuration, status: quizStatus } = useQuiz();

const { isAdmin } = useAdminRole();

// --- 抽奖状态 ---
const drawCount = ref<number>(1);

const isDev = import.meta.env.DEV;
</script>

<template>
  <DevDebugBar v-if="isDev" />
  <DanmakuLayer />
  <LotteryBar />

  <QuizBar :admin-view="isAdmin" />

  <div v-if="isAdmin" class="admin-panel">
    <h3>📺 场控台</h3>
    <div class="admin-group">
      <div class="label">1. 倒计时显示</div>
      <div class="btn-row">
        <button
          @click="timerDuration = 15"
          :class="{ active: timerDuration === 15 }"
        >
          15s
        </button>
        <button
          @click="timerDuration = 30"
          :class="{ active: timerDuration === 30 }"
        >
          30s
        </button>
        <button
          @click="timerDuration = 60"
          :class="{ active: timerDuration === 60 }"
        >
          60s
        </button>
      </div>
    </div>
    <div class="admin-group">
      <div class="label">2. 流程控制</div>
      <div class="btn-row">
        <button
          @click="sendAdmin({ action: 'start' })"
          :disabled="quizStatus === 'active'"
          class="btn-primary"
        >
          ▶ 开始
        </button>
        <button
          @click="sendAdmin({ action: 'stop' })"
          :disabled="quizStatus !== 'active'"
          class="btn-warning"
        >
          ⏸ 锁榜
        </button>
        <button @click="sendAdmin({ action: 'reset' })" class="btn-danger">
          🔄 关闭
        </button>
      </div>
    </div>
    <div class="admin-group">
      <div class="label">3. 结果 & 抽奖</div>
      <div class="btn-row" style="margin-bottom: 8px">
        <button
          v-for="opt in QUIZ_OPTIONS"
          :key="opt"
          @click="sendAdmin({ action: 'answer', arg: opt })"
        >
          {{ opt }}
        </button>
      </div>
      <div class="label">幸运抽奖</div>
      <div class="btn-row">
        <input type="number" v-model="drawCount" min="1" class="admin-input" />
        <button
          @click="sendAdmin({ action: 'draw', arg: drawCount })"
          :disabled="quizStatus !== 'revealed'"
          class="btn-gold"
        >
          🎲 抽取 {{ drawCount }} 人
        </button>
      </div>
    </div>
  </div>
</template>
