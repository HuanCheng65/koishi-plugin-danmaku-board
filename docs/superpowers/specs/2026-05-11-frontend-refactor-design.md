# 前端重构设计文档

**日期**：2026-05-11
**作者**：HuanCheng65（与 Claude 协作）
**项目**：koishi-plugin-danmaku-board / frontend

## 1. 背景与目标

当前前端代码集中在三个文件里：

- [frontend/src/App.vue](../../../frontend/src/App.vue)：355 行单文件 SFC，混合 4 个独立特性（弹幕渲染、答题条、抽奖条、场控面板）+ socket 初始化 + DOM 创建工具函数
- [frontend/src/style.css](../../../frontend/src/style.css)：485 行全局样式，4 个模块的样式平铺
- [frontend/src/main.js](../../../frontend/src/main.js)：JS，仅 mount

主要问题：

1. **职责混杂**：弹幕、答题、抽奖、admin 四个特性在 App.vue 中无界限
2. **状态散乱**：跨状态不变量（如"开新一轮 quiz 时抽奖应消失"）在两处维护
3. **无类型**：socket 事件名、payload、状态字面量都是 magic string；前后端各自约定无单一事实源
4. **CSS 无作用域**：485 行全局 CSS，跨模块的"远程影响"选择器（`.admin-view.flat-quiz-bar`）让样式难以追踪
5. **生命周期问题**：socket 在 `onMounted` 创建但未清理；danmaku 实例的 listener 同理
6. **常量散落**：`['A','B','C','D']`、`[15,30,60]` 这类硬编码在多处重复

目标：**结构清晰、单一事实源、类型完整、可被独立理解的模块。** 不引入新框架（仅基础设施依赖：TypeScript、Vitest）；视觉行为完全保持一致。

## 2. 设计决策（已确认）

| 决策点 | 选择 |
|---|---|
| 重构力度 | 重度（拆组件 + composable + TS + 共享类型） |
| 状态管理 | composable（不引 Pinia） |
| 共享类型位置 | `shared/` 顶层目录，前后端共用 |
| 后端是否接入共享类型 | 接入；仅动类型不动业务逻辑 |
| CSS 策略 | `<style scoped>` 按组件拆，保留最小化 `base.css` |
| 测试 | 引入 Vitest；只写真正有用的测试（`useQuiz.getPercent` + `useLottery` 状态机） |

## 3. 目标文件结构

```
shared/
  protocol.ts                     # socket 双向事件 + payload 类型 + QuizStatus/QuizOption/AdminAction

frontend/
  tsconfig.json                   # 新增；含 @/* 与 @shared/* 两个 path
  vite.config.ts                  # JS→TS；alias 与 tsconfig 对齐
  vitest.config.ts                # 新增
  package.json                    # 加 typescript / vue-tsc / vitest / @types/node
  src/
    main.ts
    App.vue                       # 瘦壳：约 15 行
    composables/
      useSocket.ts                # 单例 typed Socket
      useQuiz.ts                  # 答题状态机 + 倒计时键 + sendAdmin
      useLottery.ts               # 抽奖状态 + 隐式可见性规则
      useDanmaku.ts               # 封装 danmaku 库，emit/revoke
      useAdminRole.ts             # ?role=admin 解析
    components/
      DanmakuLayer.vue
      DevDebugBar.vue
      quiz/
        QuizBar.vue
        QuizTimer.vue
        QuizStatusBadge.vue
        QuizInstruction.vue
        QuizChart.vue
      lottery/
        LotteryBar.vue
        LotteryWinnerCard.vue
      admin/
        AdminPanel.vue
        AdminTimerSelect.vue
        AdminFlowControls.vue
        AdminResultDraw.vue
    constants/
      quiz.ts                     # QUIZ_OPTIONS / TIMER_PRESETS
    styles/
      base.css                    # 全局必需的最小集（约 50 行）
    __tests__/
      useQuiz.test.ts
      useLottery.test.ts
```

组件按"特性目录"分组（quiz / lottery / admin），不按类型分。改一个特性时所有相关文件在一处。

## 4. shared/protocol.ts —— 单一事实源

```ts
// ── 业务原子 ───────────────────────────────────
export type QuizStatus = 'idle' | 'active' | 'locked' | 'revealed';
export type QuizOption = 'A' | 'B' | 'C' | 'D';
export const QUIZ_OPTIONS = ['A', 'B', 'C', 'D'] as const;

// ── 弹幕内容 ───────────────────────────────────
export type DanmakuItem =
  | { type: 'text'; content: string }
  | { type: 'face'; id?: number; name: string; src: string };

// ── 事件 payload ───────────────────────────────
export interface ReceiveDanmakuPayload {
  id?: string;
  sender: { id: string; name: string };
  group:  { id: string };
  content: DanmakuItem[];
  text: string;
  color?: string | null;
}

export interface RevokeDanmakuPayload { id: string }

export interface QuizUpdatePayload {
  status: QuizStatus;
  counts: Record<QuizOption, number>;
  total: number;
  correctAnswer: QuizOption | null;
}

export interface LotteryWinner {
  id: string;
  name: string;
  avatar: string;
  answer: QuizOption;
}

// ── Admin 控制：判别联合 ───────────────────────
export type AdminAction =
  | { action: 'start' }
  | { action: 'stop' }
  | { action: 'reset' }
  | { action: 'answer'; arg: QuizOption }
  | { action: 'draw';   arg: number };

export interface SendDanmakuPayload { content: DanmakuItem[] }

// ── Socket.io 双向事件表 ───────────────────────
export interface ServerToClientEvents {
  receive_danmaku: (p: ReceiveDanmakuPayload) => void;
  revoke_danmaku:  (p: RevokeDanmakuPayload)  => void;
  quiz_update:     (p: QuizUpdatePayload)     => void;
  lottery_result:  (p: LotteryWinner[])       => void;
}
export interface ClientToServerEvents {
  admin_control: (p: AdminAction)        => void;
  send_danmaku:  (p: SendDanmakuPayload) => void;
}
```

关键点：

- **`AdminAction` 是判别联合**：`switch (action)` 各 case 里 `arg` 类型被收窄（answer → QuizOption；draw → number；reset/start/stop 无 arg）。运行时校验保留。
- **`QUIZ_OPTIONS` 是 `as const`**：前端 v-for、后端 counts 初始化共用，消除两处硬编码。
- **Socket 双向类型表**：前后端用 `Socket<ServerToClientEvents, ClientToServerEvents>` / `Server<ClientToServerEvents, ServerToClientEvents>` 后，事件名拼错或 payload 字段缺失 TS 直接报。

## 5. Composables 设计

### 5.1 useSocket()

```ts
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/protocol';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let _socket: AppSocket | null = null;

export function useSocket(): AppSocket {
  if (!_socket) _socket = io();
  return _socket;
}
```

- 单例：整个 app 只一个 socket（当前代码也是该语义，但藏在 onMounted 里）
- 不暴露 `connect/disconnect`：本 app 语义就是页面打开后一直连
- 不暴露事件清理：composable 在其内部 `socket.on()` 注册的回调与 socket 同生命周期，app 单例不会泄漏

### 5.2 useQuiz()

```ts
export function useQuiz() {
  const socket = useSocket();
  const status        = ref<QuizStatus>('idle');
  const counts        = ref<Record<QuizOption, number>>({ A:0, B:0, C:0, D:0 });
  const total         = ref(0);
  const correctAnswer = ref<QuizOption | null>(null);

  const timerDuration = ref(30);
  const timerKey      = ref(0);

  const visible = computed(() => status.value !== 'idle');

  socket.on('quiz_update', p => {
    status.value        = p.status;
    counts.value        = p.counts;
    total.value         = p.total;
    correctAnswer.value = p.correctAnswer;
  });

  function getPercent(opt: QuizOption): number {
    return computePercent({
      counts: counts.value,
      total: total.value,
      status: status.value,
      correctAnswer: correctAnswer.value,
      option: opt,
    });
  }

  function sendAdmin(payload: AdminAction) {
    if (payload.action === 'start') timerKey.value++;
    socket.emit('admin_control', payload);
  }

  return { status, counts, total, correctAnswer, timerDuration, timerKey,
           visible, getPercent, sendAdmin };
}
```

`computePercent` 是模块顶层的纯函数（导出供测试）：

```ts
export function computePercent(args: {
  counts: Record<QuizOption, number>;
  total: number;
  status: QuizStatus;
  correctAnswer: QuizOption | null;
  option: QuizOption;
}): number {
  const { counts, total, status, correctAnswer, option } = args;
  if (total === 0) {
    return status === 'revealed' && correctAnswer === option ? 15 : 0;
  }
  const pct = (counts[option] / total) * 100;
  if (status === 'revealed' && correctAnswer === option) {
    return Math.max(pct, 12);
  }
  return Math.round(pct * 10) / 10;
}
```

- `timerKey` 留在 useQuiz 中（本质是"重启倒计时动画"的信号，跟 quiz 是一伙的）
- `sendAdmin` 类型化：调错 TS 直接报

### 5.3 useLottery()

```ts
export function useLottery() {
  const socket = useSocket();
  const winners = ref<LotteryWinner[]>([]);
  const visible = ref(false);

  socket.on('lottery_result', list => {
    winners.value = list;
    visible.value = true;
  });

  socket.on('quiz_update', p => {
    if (p.status === 'idle' || p.status === 'active') visible.value = false;
  });

  return { winners, visible };
}
```

- 解开当前代码最脏的一块：`adminAction()` 中手动 `winners.value=[]; showWinners.value=false`，又在 `quiz_update` 处理函数里再写一次。两处靠"约定"维护同一不变量。
- 改完后：抽奖的可见性规则全在 useLottery 内部，外界看不到。

### 5.4 useDanmaku()

```ts
export function useDanmaku() {
  const socket = useSocket();
  let instance: Danmaku | null = null;
  let containerEl: HTMLElement | null = null;

  const handleReceive = (data: ReceiveDanmakuPayload) => {
    instance?.emit({ render() { /* createTextElement/createFaceElement */ } });
  };
  const handleRevoke = ({ id }: RevokeDanmakuPayload) => {
    if (!containerEl) return;
    const el = containerEl.querySelector<HTMLElement>(`.danmaku-item[data-id="${id}"]`);
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  };

  function mount(el: HTMLElement) {
    containerEl = el;
    instance = new Danmaku({ container: el, engine: 'dom' });
    socket.on('receive_danmaku', handleReceive);
    socket.on('revoke_danmaku', handleRevoke);
  }
  function destroy() {
    instance?.destroy();
    socket.off('receive_danmaku', handleReceive);
    socket.off('revoke_danmaku', handleRevoke);
    instance = null;
    containerEl = null;
  }
  return { mount, destroy };
}
```

- `createTextElement` / `createFaceElement` 内联到文件，不暴露
- `mount` 在 `DanmakuLayer.vue` 的 `onMounted` 中调用，`destroy` 在 `onBeforeUnmount` 中调用
- 修复当前代码"没清理 listener"的隐患（虽然 App 单实例不构成实际问题，但模式更干净）

### 5.5 useAdminRole()

```ts
export function useAdminRole() {
  const isAdmin = new URLSearchParams(location.search).get('role') === 'admin';
  return { isAdmin };
}
```

## 6. 组件设计

### 6.1 App.vue 重构后

```vue
<script setup lang="ts">
import { useAdminRole } from '@/composables/useAdminRole';
import DanmakuLayer from '@/components/DanmakuLayer.vue';
import QuizBar     from '@/components/quiz/QuizBar.vue';
import LotteryBar  from '@/components/lottery/LotteryBar.vue';
import AdminPanel  from '@/components/admin/AdminPanel.vue';
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
```

约 15 行。App.vue 不再持有任何业务状态。

### 6.2 组件职责表

| 组件 | 职责 | 数据来源 |
|------|------|---------|
| `DanmakuLayer.vue` | `<div id="my-container">` + onMounted 调用 `useDanmaku().mount(el)` | useDanmaku |
| `DevDebugBar.vue` | DEV 模式下的测试按钮 | useSocket（emit 测试弹幕） |
| `quiz/QuizBar.vue` | quiz 主条容器、`<transition name="slide-up">`、组装 4 个子件、应用 `admin-view` class | useQuiz；props: `adminView` |
| `quiz/QuizTimer.vue` | 顶部 `.timer-border`，倒计时动画 | props: `duration`, `running`, `restartKey`（由 QuizBar 把 useQuiz 的 `timerKey` 透传为该 prop，QuizTimer 用 `:key="restartKey"` 触发重启） |
| `quiz/QuizStatusBadge.vue` | LIVE/LOCKED/RESULT/READY + transition | props: `status` |
| `quiz/QuizInstruction.vue` | 中间提示文字 + transition | props: `status`, `correctAnswer` |
| `quiz/QuizChart.vue` | 4 段堆叠图 + winner check 动画 | props: `status`, `counts`, `correctAnswer`, `getPercent` |
| `lottery/LotteryBar.vue` | 抽奖横条 + slide transition | useLottery |
| `lottery/LotteryWinnerCard.vue` | 单个获奖卡片 + `animationDelay` | props: `winner`, `index` |
| `admin/AdminPanel.vue` | 三个 admin-group 容器 | useQuiz |
| `admin/AdminTimerSelect.vue` | 15/30/60 倒计时选择 | `v-model:duration` |
| `admin/AdminFlowControls.vue` | 开始/锁榜/关闭 | useQuiz.sendAdmin、useQuiz.status |
| `admin/AdminResultDraw.vue` | 答案 A/B/C/D + 抽奖人数 input + 抽取 | useQuiz.sendAdmin、useQuiz.status |

关键设计点：

1. **QuizBar 与 AdminPanel 共用 useQuiz**。任何 admin 操作都走 `useQuiz().sendAdmin({...})`，没有组件直接碰 socket。
2. **`admin-view` 缩放是 QuizBar 自己的样式变体**，不是 AdminPanel 的事。QuizBar 收 `adminView: boolean` prop。AdminPanel 完全不知 QuizBar 存在。
3. **`QuizChart` 的选项列表来自 `@/constants/quiz` 的 `QUIZ_OPTIONS`**。AdminResultDraw 答案按钮同源。
4. **`QuizTimer` 的重启动画**保留 `:key="restartKey"` 技巧。`restartKey` 由 useQuiz 维护、由 QuizBar 透传。
5. **`DanmakuLayer` 用 template ref**：通过 `ref` 获得 DOM 后调 `useDanmaku.mount(el)`，不依赖 `document.getElementById` / `nextTick`。

## 7. CSS 拆分

### 7.1 base.css（保留全局，约 50 行）

- html/body reset
- `#my-container` 定位
- `.danmaku-item` / `.danmaku-text` / `.danmaku-face`：由 danmaku 库 imperative 创建的 DOM，scoped 选择器无法命中，**必须**全局

### 7.2 下沉映射表

| 当前 style.css 中的块 | 去向 |
|---|---|
| `.flat-lottery-bar`, `.lottery-header`, `.lottery-list-track`, `@keyframes slideInRight`, `.lottery-slide-*` | `lottery/LotteryBar.vue` |
| `.flat-winner-card`, `.sq-avatar`, `.sq-info`, `.sq-name`, `.sq-id` | `lottery/LotteryWinnerCard.vue` |
| `.flat-quiz-bar`, `.slide-up-*`, `.admin-view.flat-quiz-bar` | `quiz/QuizBar.vue` |
| `.timer-border`, `@keyframes shrinkCenter` | `quiz/QuizTimer.vue` |
| `.status-badge.*`, `@keyframes blink`, `.text-slide-*` | `quiz/QuizStatusBadge.vue` |
| `.instruction-text`, `.key-box`, `.bar-info-grid`, `.grid-*`, `.total-text` | `quiz/QuizInstruction.vue` + `quiz/QuizBar.vue`（grid 布局留容器） |
| `.stacked-chart-track`, `.chart-segment`, `.seg-*`, `.winner-check`, `@keyframes bounceIn` | `quiz/QuizChart.vue` |
| `.admin-panel`, `.admin-group`, `.label`, `.btn-row`, `.admin-input`, `.btn-primary/.btn-warning/.btn-danger/.btn-gold` | `admin/AdminPanel.vue` + 子组件 |

`normalize.css` 保留在 `main.ts` 的 import。字体声明（"Montserrat"/"Impact" 等）原样下沉到对应组件 scoped，**不**抽字体 token。

## 8. 后端类型对齐

`src/index.ts` 改动范围：

1. `import` shared/protocol 中的类型
2. `new Server(...)` → `new Server<ClientToServerEvents, ServerToClientEvents>(...)`
3. 所有 `io.emit(...)` / `socket.emit(...)` 调用按 typed 签名对齐字段
4. `quizState.counts: Record<string, number>` → `Record<QuizOption, number>`
5. `admin_control` 的 `switch` 改为消费 `AdminAction` 判别联合

**仅类型，不动业务逻辑。** 任何运行时校验（`/^[ABCD]$/.test(arg)`、`parseInt`）保留。

## 9. 测试

### 9.1 工具

- **Vitest**（Vite 原生）
- 不引 `@vue/test-utils`（不测组件渲染）
- `package.json` 新增 `"test": "vitest run"` 和 `"test:watch": "vitest"`

### 9.2 测试范围

**`useQuiz.test.ts` —— `computePercent` 纯函数**

| 输入 | 期望 |
|---|---|
| `total=0`, `status='active'`, 任意 opt | `0` |
| `total=0`, `status='revealed'`, opt = correctAnswer | `15` |
| `total=0`, `status='revealed'`, opt ≠ correctAnswer | `0` |
| `total=10`, counts.A=3, `status='active'`, opt='A' | `30` |
| `total=100`, counts.A=33, `status='active'`, opt='A' | `33` |
| `total=100`, counts.A=7, `status='revealed'`, correctAnswer='A', opt='A' | `12` |
| `total=100`, counts.A=33, `status='revealed'`, correctAnswer='A', opt='A' | `33` |
| `total=3`, counts.A=1, `status='active'`, opt='A' | `33.3` |

**`useLottery.test.ts` —— 可见性状态机**

| 事件序列 | `visible` 终态 |
|---|---|
| `lottery_result([w1,w2])` | `true` |
| `lottery_result(...)` → `quiz_update{status:'idle'}` | `false` |
| `lottery_result(...)` → `quiz_update{status:'active'}` | `false` |
| `lottery_result(...)` → `quiz_update{status:'locked'}` | `true` |
| `lottery_result(...)` → `quiz_update{status:'revealed'}` | `true` |
| `quiz_update{status:'idle'}` → `lottery_result(...)` → `quiz_update{status:'locked'}` | `true` |

测试基建：~12 行 `mockSocket` 工具（`{ on, off, emit, _trigger }`），useSocket 通过 `vi.mock` 替换。不引 socket.io 真实代码。

### 9.3 不写的（明确）

- `useDanmaku`：DOM 创建 + danmaku 库副作用
- `useSocket`：单例 + io() 调用，无逻辑
- `useAdminRole`：一行 URL 解析
- 组件渲染测试（动画/过渡/视觉效果，单测捕获不到真问题）
- 后端 `admin_control` switch（本轮仅类型对齐，逻辑不动）

## 10. 迁移顺序

每一步都能独立运行验证。

1. **TS 基建**：装 typescript / vue-tsc，写 `tsconfig.json`（含 `@/*` 和 `@shared/*`），改 `vite.config.js` → `vite.config.ts`。`npm run build` 通。
2. **写 shared/protocol.ts**。
3. **后端 src/index.ts 接入类型**。`server` 工程 build 通。
4. **main.js → main.ts**；App.vue 加 `lang="ts"`。允许临时 `any`。dev server 跑通。
5. **抽 composables（按依赖序）**：useSocket → useDanmaku → useQuiz → useLottery → useAdminRole。每抽一个，App.vue 对应代码删除，浏览器验证：弹幕能收 / 答题能投 / 撤回能消 / 抽奖能出。
   - **5a.** 抽 useQuiz 时同步写 `useQuiz.test.ts`
   - **5b.** 抽 useLottery 时同步写 `useLottery.test.ts`
6. **抽组件**：先抽叶子（QuizTimer / QuizStatusBadge / QuizInstruction / QuizChart / LotteryWinnerCard / Admin 三个子件），再抽容器（QuizBar / LotteryBar / AdminPanel / DanmakuLayer / DevDebugBar）。每抽一个或一组：对应 CSS 同步下沉到该组件 scoped，从 base.css 删除对应块。每步浏览器验证。
7. **base.css 收尾**：检查剩余条目，删除孤儿规则。
8. **验证关口**：
   - `npm test` 必过
   - dev server 走一遍 admin 全流程（开始 → 投票 → 锁榜 → 揭晓 → 抽奖 → 关闭）
   - 撤回弹幕、DEV 测试按钮都走一遍

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| TS 引入导致构建链断裂 | 第 1 步独立验证 `npm run build`；任何 `any` 临时允许 |
| 后端类型对齐过程中改坏运行时 | 严格"仅动类型"；提交粒度小；每改一处过一次 `tsc --noEmit` |
| scoped CSS 后 `.admin-view.flat-quiz-bar` 不再命中 | 设计已把 admin-view 收为 QuizBar 自己的 prop 触发的 class，scoped 下命中 root 元素自身正常 |
| danmaku 库 imperative DOM 不受 Vue scoped 影响 | 设计已识别，相关样式保留全局 |
| 抽奖可见性规则集中后行为偏差 | useLottery 配套单测固化六种序列下的终态 |
| 视觉回归（动画时序/transition） | CSS 块整段平移、不重写规则；每抽一个组件浏览器肉眼验一遍 |

## 12. 不在本次范围内

- 后端业务逻辑重构（parseMessage、checkContent、quiz 投票去重等）
- 测试覆盖率指标
- 字体/颜色 token 抽象
- 国际化
- 移动端适配
- 抽奖洗牌算法测试（随机性、ROI 低）
