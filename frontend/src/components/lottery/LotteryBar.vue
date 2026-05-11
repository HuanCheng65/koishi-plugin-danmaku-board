<script setup lang="ts">
import { useLottery } from '@/composables/useLottery';
import LotteryWinnerCard from './LotteryWinnerCard.vue';

const { winners, visible } = useLottery();
</script>

<template>
  <transition name="lottery-slide">
    <div v-if="visible && winners.length > 0" class="flat-lottery-bar">
      <div class="lottery-header">
        <div class="lottery-title">WINNERS</div>
        <div class="lottery-subtitle">LUCKY DRAW</div>
      </div>

      <div class="lottery-list-track">
        <LotteryWinnerCard
          v-for="(user, index) in winners"
          :key="user.id"
          :winner="user"
          :index="index"
        />
      </div>
    </div>
  </transition>
</template>

<style scoped>
.flat-lottery-bar {
  position: fixed;
  bottom: 120px;
  left: 0;
  width: 100%;
  height: 80px;
  z-index: 9990;
  display: flex;
  background: #000000;
  border-top: 4px solid #ffd700;
  font-family: "Montserrat", "Impact", sans-serif;
  overflow: hidden;
}

.lottery-header {
  width: 140px;
  background: #ffd700;
  color: #000;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  line-height: 1;
}
.lottery-title {
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -1px;
}
.lottery-subtitle {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2px;
  margin-top: 4px;
}

.lottery-list-track {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 20px;
  overflow: hidden;
  background: rgba(255, 215, 0, 0.05);
}

.lottery-slide-enter-active {
  transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.lottery-slide-leave-active {
  transition: all 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.lottery-slide-enter-from {
  opacity: 0;
  transform: translateY(100%);
  z-index: -1;
}

.lottery-slide-leave-to {
  opacity: 0;
  transform: translateY(300%);
}
</style>
