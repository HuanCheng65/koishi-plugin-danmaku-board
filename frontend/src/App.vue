<script setup lang="ts">
import { useAdminRole } from '@/composables/useAdminRole';
import DanmakuLayer from '@/components/DanmakuLayer.vue';
import QuizBar from '@/components/quiz/QuizBar.vue';
import LotteryBar from '@/components/lottery/LotteryBar.vue';
import AdminPanel from '@/components/admin/AdminPanel.vue';
import DevDebugBar from '@/components/DevDebugBar.vue';

const { isAdmin } = useAdminRole();
const isDev = import.meta.env.DEV;
</script>

<template>
  <DevDebugBar v-if="isDev" />
  <DanmakuLayer />
  <LotteryBar />
  <QuizBar :admin-view="isAdmin" />
  <AdminPanel v-if="isAdmin" />
</template>
