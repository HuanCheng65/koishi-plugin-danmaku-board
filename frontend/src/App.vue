<script setup>
import Danmaku from "danmaku";
import { nextTick, onMounted } from "vue";
import { io } from "socket.io-client";

let socket = null;

const isDebug = import.meta.env.DEV;

const sendDanmaku = (text) => {
  if (socket) {
    socket.emit("send_danmaku", {
      content: [
        {
          type: "text",
          content: text,
        },
      ],
    });
  }
};

const createTextElement = (text) => {
  const span = document.createElement("span");
  span.classList.add("danmaku-text");
  span.textContent = text;
  return span;
};

const createFaceElement = (src, name) => {
  const img = document.createElement("img");
  img.classList.add("danmaku-face");
  img.src = src;
  img.alt = name;
  return img;
};

onMounted(() => {
  socket = io();

  nextTick(() => {
    const danmaku = new Danmaku({
      container: document.getElementById("my-container"),
      engine: "dom",
    });

    socket.on("receive_danmaku", (data) => {
      console.log(data);
      danmaku.emit({
        render() {
          const container = document.createElement("div");
          container.classList.add("danmaku-item");
          if (data.color) {
            container.style.color = data.color;
          }
          const contentEls = data.content.map((item) => {
            if (item.type === "text") {
              return createTextElement(item.content);
            } else if (item.type === "face") {
              return createFaceElement(item.src, item.name);
            }
          });
          contentEls.forEach((el) => {
            container.appendChild(el);
          });
          return container;
        },
      });
    });
  });
});
</script>

<template>
  <template v-if="isDebug">
    <button @click="sendDanmaku('Hello')">Send Danmaku</button>
  </template>
  <div id="my-container"></div>
</template>
