<script setup lang="ts">
import { ref } from "vue";
import { useQuiz } from "@/composables/useQuiz";
import { useLottery } from "@/composables/useLottery";
import { useAdminRole } from "@/composables/useAdminRole";
import { QUIZ_OPTIONS } from "@/constants/quiz";
import DevDebugBar from "@/components/DevDebugBar.vue";
import DanmakuLayer from "@/components/DanmakuLayer.vue";

const {
  status: quizStatus,
  counts: quizCounts,
  total: quizTotal,
  correctAnswer,
  timerDuration,
  timerKey,
  visible: quizVisible,
  getPercent: getPercentNum,
  sendAdmin,
} = useQuiz();

const { isAdmin } = useAdminRole();

// --- 抽奖状态 ---
const drawCount = ref<number>(1);
const { winners, visible: showWinners } = useLottery();

const isDev = import.meta.env.DEV;
</script>

<template>
  <DevDebugBar v-if="isDev" />
  <DanmakuLayer />

  <transition name="lottery-slide">
    <div v-if="showWinners && winners.length > 0" class="flat-lottery-bar">
      <div class="lottery-header">
        <div class="lottery-title">WINNERS</div>
        <div class="lottery-subtitle">LUCKY DRAW</div>
      </div>

      <div class="lottery-list-track">
        <div
          v-for="(user, index) in winners"
          :key="user.id"
          class="flat-winner-card"
          :style="{ animationDelay: index * 0.1 + 's' }"
        >
          <div class="sq-avatar">
            <img :src="user.avatar" onerror="this.style.opacity=0" />
          </div>
          <div class="sq-info">
            <div class="sq-name">{{ user.name }}</div>
            <div class="sq-id">ID: {{ user.id }}</div>
          </div>
        </div>
      </div>
    </div>
  </transition>

  <transition name="slide-up">
    <div
      v-if="quizVisible || isAdmin"
      class="flat-quiz-bar"
      :class="{ 'admin-view': isAdmin }"
    >
      <div
        class="timer-border"
        :class="{ running: quizStatus === 'active' }"
        :style="{ animationDuration: timerDuration + 's' }"
        :key="timerKey"
      ></div>

      <div class="bar-info-grid">
        <div class="grid-left">
          <transition name="text-slide" mode="out-in">
            <span v-if="quizStatus === 'active'" class="status-badge live"
              >● LIVE</span
            >
            <span
              v-else-if="quizStatus === 'locked'"
              class="status-badge locked"
              >🔒 LOCKED</span
            >
            <span
              v-else-if="quizStatus === 'revealed'"
              class="status-badge result"
              >🎉 RESULT</span
            >
            <span v-else class="status-badge ready">READY</span>
          </transition>
        </div>

        <div class="grid-center">
          <transition name="text-slide" mode="out-in">
            <div
              v-if="quizStatus === 'active' || quizStatus === 'idle'"
              key="tip-active"
              class="instruction-text"
            >
              发送弹幕 <span class="key-box">A</span>
              <span class="key-box">B</span> <span class="key-box">C</span>
              <span class="key-box">D</span> 抢答
            </div>
            <div
              v-else-if="quizStatus === 'locked'"
              key="tip-locked"
              class="instruction-text"
            >
              ✋ 答题结束 · 等待揭晓
            </div>
            <div v-else key="tip-result" class="instruction-text">
              正确答案
              <span class="key-box winner-key">{{ correctAnswer }}</span>
            </div>
          </transition>
        </div>

        <div class="grid-right total-text">
          VOTES: <b>{{ quizTotal }}</b>
        </div>
      </div>

      <div class="stacked-chart-track">
        <div
          v-for="opt in QUIZ_OPTIONS"
          :key="opt"
          class="chart-segment"
          :class="[
            'seg-' + opt.toLowerCase(),
            {
              'is-dimmed': quizStatus === 'revealed' && correctAnswer !== opt,
              'is-winner': quizStatus === 'revealed' && correctAnswer === opt,
            },
          ]"
          :style="{ width: getPercentNum(opt) + '%' }"
        >
          <div
            class="seg-content"
            v-if="
              getPercentNum(opt) > 6 ||
              (quizStatus === 'revealed' && correctAnswer === opt)
            "
          >
            <span class="seg-label">{{ opt }}</span>
            <span class="seg-data">{{ quizCounts[opt] }}</span>
          </div>

          <transition name="bounce-in">
            <div
              v-if="quizStatus === 'revealed' && correctAnswer === opt"
              class="winner-check"
            >
              ✓
            </div>
          </transition>
        </div>
      </div>
    </div>
  </transition>

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
