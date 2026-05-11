<script setup lang="ts">
import { onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import { useDanmaku } from '@/composables/useDanmaku';

const containerRef = useTemplateRef<HTMLDivElement>('container');
const { mount, destroy } = useDanmaku();

onMounted(() => {
  if (containerRef.value) mount(containerRef.value);
});

onBeforeUnmount(() => {
  destroy();
});
</script>

<template>
  <div id="my-container" ref="container"></div>
</template>

<!-- No scoped styles. #my-container lives in base.css because the danmaku
     library injects imperative DOM that scoped selectors can't reach. -->
