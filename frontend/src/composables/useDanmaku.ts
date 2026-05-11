import Danmaku from 'danmaku';
import type { ReceiveDanmakuPayload, RevokeDanmakuPayload, DanmakuItem } from '@shared/protocol';
import { useSocket } from './useSocket';

function createTextElement(text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.classList.add('danmaku-text');
  span.textContent = text;
  return span;
}

function createFaceElement(src: string, name: string): HTMLImageElement {
  const img = document.createElement('img');
  img.classList.add('danmaku-face');
  img.src = src;
  img.alt = name;
  return img;
}

function renderDanmakuItem(data: ReceiveDanmakuPayload): HTMLElement {
  const container = document.createElement('div');
  container.classList.add('danmaku-item');
  if (data.id) container.dataset.id = data.id;
  if (data.color) container.style.color = data.color;
  data.content.forEach((item: DanmakuItem) => {
    if (item.type === 'text') {
      container.appendChild(createTextElement(item.content));
    } else if (item.type === 'face') {
      if (item.src) container.appendChild(createFaceElement(item.src, item.name));
    }
  });
  return container;
}

export function useDanmaku() {
  const socket = useSocket();
  let instance: Danmaku | null = null;
  let containerEl: HTMLElement | null = null;

  const handleReceive = (data: ReceiveDanmakuPayload) => {
    if (!instance) return;
    instance.emit({ render: () => renderDanmakuItem(data) });
  };

  const handleRevoke = ({ id }: RevokeDanmakuPayload) => {
    if (!containerEl || !id) return;
    const el = containerEl.querySelector<HTMLElement>(`.danmaku-item[data-id="${id}"]`);
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  };

  function mount(el: HTMLElement): void {
    containerEl = el;
    instance = new Danmaku({ container: el, engine: 'dom' });
    socket.on('receive_danmaku', handleReceive);
    socket.on('revoke_danmaku', handleRevoke);
  }

  function destroy(): void {
    socket.off('receive_danmaku', handleReceive);
    socket.off('revoke_danmaku', handleRevoke);
    instance?.destroy();
    instance = null;
    containerEl = null;
  }

  return { mount, destroy };
}
