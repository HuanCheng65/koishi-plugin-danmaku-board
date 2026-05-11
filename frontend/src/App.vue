<script setup lang="ts">
import Danmaku from "danmaku";
import { nextTick, onMounted, ref } from "vue";
import { QUIZ_OPTIONS } from "@shared/protocol";
import type {
  ReceiveDanmakuPayload,
  RevokeDanmakuPayload,
  QuizUpdatePayload,
  LotteryWinner,
  QuizOption,
  QuizStatus,
  AdminAction,
} from "@shared/protocol";
import { useSocket } from "@/composables/useSocket";

const socket = useSocket();

// --- 状态定义 ---
const isAdmin = ref<boolean>(false);
const quizStatus = ref<QuizStatus>("idle");
const quizCounts = ref<Record<QuizOption, number>>({ A: 0, B: 0, C: 0, D: 0 });
const quizTotal = ref<number>(0);
const correctAnswer = ref<QuizOption | null>(null);
const quizVisible = ref<boolean>(false);

// 倒计时视觉配置
const timerDuration = ref<number>(30);
const timerKey = ref<number>(0);

// --- 抽奖新增状态 ---
const drawCount = ref<number>(1);
const winners = ref<LotteryWinner[]>([]);
const showWinners = ref<boolean>(false);

const isDebug = import.meta.env.DEV;

// 计算百分比逻辑 (含赢家保底)
const getPercentNum = (option: QuizOption): number => {
  if (quizTotal.value === 0) {
    if (quizStatus.value === "revealed" && correctAnswer.value === option)
      return 15;
    return 0;
  }
  let percent = (quizCounts.value[option] / quizTotal.value) * 100;
  if (quizStatus.value === "revealed" && correctAnswer.value === option) {
    return Math.max(percent, 12);
  }
  return Math.round(percent * 10) / 10;
};

// --- Socket & Actions ---
const sendDanmaku = (text: string): void => {
  socket.emit("send_danmaku", { content: [{ type: "text", content: text }] });
};

const createTextElement = (text: string): HTMLSpanElement => {
  const span = document.createElement("span");
  span.classList.add("danmaku-text");
  span.textContent = text;
  return span;
};

const createFaceElement = (src: string, name: string): HTMLImageElement => {
  const img = document.createElement("img");
  img.classList.add("danmaku-face");
  img.src = src;
  img.alt = name;
  return img;
};

const adminAction = (action: AdminAction['action'], arg: any = null): void => {
  if (action === "start") {
    timerKey.value++;
    winners.value = [];
    showWinners.value = false;
  }
  if (action === "reset") {
    winners.value = [];
    showWinners.value = false;
  }
  socket.emit("admin_control", { action, arg } as AdminAction);
};

onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("role") === "admin") isAdmin.value = true;

  nextTick(() => {
    const danmaku = new Danmaku({
      container: document.getElementById("my-container")!,
      engine: "dom",
    });

    socket.on("receive_danmaku", (data: ReceiveDanmakuPayload) => {
      danmaku.emit({
        render() {
          const container = document.createElement("div");
          container.classList.add("danmaku-item");
          if (data.id) container.dataset.id = data.id;
          if (data.color) container.style.color = data.color;
          data.content.forEach((item) => {
            if (item.type === "text")
              container.appendChild(createTextElement(item.content));
            else if (item.type === "face")
              container.appendChild(createFaceElement(item.src ?? "", item.name));
          });
          return container;
        },
      });
    });

    socket.on("revoke_danmaku", (data: RevokeDanmakuPayload) => {
      if (!data.id) return;

      // 在容器内查找对应 ID 的弹幕元素
      // 这里的 #my-container 是你在 html 里定义的 id
      const container = document.getElementById("my-container");
      if (!container) return;

      // 查找带有对应 data-id 的元素
      const targetElement = container.querySelector(
        `.danmaku-item[data-id="${data.id}"]`
      ) as HTMLElement | null;

      if (targetElement) {
        targetElement.style.opacity = "0";

        // 稍后从 DOM 中完全移除 (防止占用位置或由于弹幕引擎重绘导致闪现)
        setTimeout(() => {
          targetElement.remove();
        }, 200);
      }
    });

    socket.on("quiz_update", (data: QuizUpdatePayload) => {
      quizStatus.value = data.status;
      quizCounts.value = data.counts;
      quizTotal.value = data.total;
      correctAnswer.value = data.correctAnswer;
      quizVisible.value = data.status !== "idle";

      if (data.status === "idle" || data.status === "active") {
        showWinners.value = false;
      }
    });

    socket.on("lottery_result", (data: LotteryWinner[]) => {
      winners.value = data;
      showWinners.value = true;
    });
  });
});
</script>

<template>
  <template v-if="isDebug">
    <div style="position: fixed; top: 0; left: 0; z-index: 10001">
      <button @click="sendDanmaku('Hello')">Test</button>
    </div>
  </template>

  <div id="my-container"></div>

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
          @click="adminAction('start')"
          :disabled="quizStatus === 'active'"
          class="btn-primary"
        >
          ▶ 开始
        </button>
        <button
          @click="adminAction('stop')"
          :disabled="quizStatus !== 'active'"
          class="btn-warning"
        >
          ⏸ 锁榜
        </button>
        <button @click="adminAction('reset')" class="btn-danger">
          🔄 关闭
        </button>
      </div>
    </div>
    <div class="admin-group">
      <div class="label">3. 结果 & 抽奖</div>
      <div class="btn-row" style="margin-bottom: 8px">
        <button
          v-for="opt in ['A', 'B', 'C', 'D']"
          :key="opt"
          @click="adminAction('answer', opt)"
        >
          {{ opt }}
        </button>
      </div>
      <div class="label">幸运抽奖</div>
      <div class="btn-row">
        <input type="number" v-model="drawCount" min="1" class="admin-input" />
        <button
          @click="adminAction('draw', drawCount)"
          :disabled="quizStatus !== 'revealed'"
          class="btn-gold"
        >
          🎲 抽取 {{ drawCount }} 人
        </button>
      </div>
    </div>
  </div>
</template>
