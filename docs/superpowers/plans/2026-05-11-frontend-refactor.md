# Frontend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the danmaku-board frontend from a monolithic 355-line `App.vue` + 485-line global `style.css` into a typed, composable-driven, per-feature component structure with shared backend/frontend socket protocol types and targeted Vitest coverage.

**Architecture:** Single SPA (Vite + Vue 3). Single socket.io connection via `useSocket()` singleton. Feature state in dedicated composables (`useQuiz`, `useLottery`, `useDanmaku`). Components grouped by feature directory. CSS scoped per SFC with a minimal global `base.css` for the imperative-DOM `.danmaku-item` styles. Backend and frontend share `shared/protocol.ts` for socket events and domain types.

**Tech Stack:** Vue 3, TypeScript, Vite, socket.io, socket.io-client, danmaku, Vitest.

**Reference spec:** [docs/superpowers/specs/2026-05-11-frontend-refactor-design.md](../specs/2026-05-11-frontend-refactor-design.md)

---

## Pre-Implementation Notes

**Verification strategy.** This refactor has no existing automated tests. Verification per task is:
1. `npx vue-tsc --noEmit` (frontend) or `npx tsc --noEmit` (backend) — type check
2. `npm run build-frontend` from project root — full frontend build
3. Browser smoke test in `npm run dev` (frontend folder) — visually confirm the touched feature still works
4. After Task 7 and Task 8: `npm test` in frontend folder

**Backend build.** Backend has no explicit build script in `package.json`. Use `npx tsc --noEmit -p .` from project root to typecheck. Actual `lib/` compilation is done by Koishi tooling externally.

**Working directory.** All paths are relative to the repo root `e:\danmaku\next-danmaku-bot\external\danmaku-board\`.

**Pre-existing untracked changes.** The working tree currently shows modifications to `frontend/src/App.vue`, `frontend/src/main.js`, `frontend/src/style.css`, `package.json`, `src/index.ts`. Before starting, **stash or commit these** — they are not part of this plan and could conflict with the refactor.

```bash
git status --short
git stash push -u -m "pre-refactor wip"   # or commit if intentional
```

---

## Task 1: TypeScript foundation for frontend

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/src/env.d.ts`
- Rename: `frontend/vite.config.js` → `frontend/vite.config.ts`

- [ ] **Step 1.1: Install TypeScript toolchain and upgrade Vue**

```bash
cd frontend
npm install --save-dev typescript vue-tsc @types/node
npm install vue@^3.5.0 @vitejs/plugin-vue@latest
```

Vue is bumped from `^3.4.21` → `^3.5.x` so we can use `useTemplateRef` for type-safe template refs (Task 9 and Task 13). Vue 3.4 → 3.5 is a minor release with no breaking changes for this app.

- [ ] **Step 1.2: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "preserve",
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@shared/*": ["../shared/*"]
    },
    "noEmit": true,
    "allowImportingTsExtensions": false
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue", "../shared/**/*.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 1.3: Create `frontend/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 1.4: Create `frontend/src/env.d.ts`**

```ts
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'danmaku' {
  export default class Danmaku {
    constructor(opts: { container: HTMLElement; engine?: 'dom' | 'canvas' });
    emit(item: { render: () => HTMLElement }): void;
    destroy(): void;
  }
}
```

- [ ] **Step 1.5: Rename and update vite.config**

Rename `frontend/vite.config.js` → `frontend/vite.config.ts`. Replace its contents with:

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 1.6: Verify build still works**

```bash
cd frontend
npx vue-tsc --noEmit
npm run build
```

Expected: both succeed. `npm run build` writes to `../public`.

- [ ] **Step 1.7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/tsconfig.node.json frontend/src/env.d.ts frontend/vite.config.ts
git rm frontend/vite.config.js   # if rename wasn't tracked as rename
git commit -m "build(frontend): add TypeScript toolchain and path aliases"
```

---

## Task 2: Create `shared/protocol.ts` and wire backend tsconfig

**Files:**
- Create: `shared/protocol.ts`
- Modify: `tsconfig.json` (root, backend)
- Modify: `package.json` (root) — `main` and `typings` paths

- [ ] **Step 2.1: Create `shared/protocol.ts`**

```ts
// ── 业务原子 ───────────────────────────────────
export type QuizStatus = 'idle' | 'active' | 'locked' | 'revealed';
export type QuizOption = 'A' | 'B' | 'C' | 'D';
export const QUIZ_OPTIONS = ['A', 'B', 'C', 'D'] as const satisfies readonly QuizOption[];

// ── 弹幕内容 ───────────────────────────────────
export type DanmakuItem =
  | { type: 'text'; content: string }
  | { type: 'face'; id?: number; name: string; src: string };

// ── 事件 payload ───────────────────────────────
export interface ReceiveDanmakuPayload {
  id?: string;
  sender: { id: string; name: string };
  group: { id: string };
  content: DanmakuItem[];
  text: string;
  color?: string | null;
}

export interface RevokeDanmakuPayload {
  id: string;
}

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
  | { action: 'draw'; arg: number };

export interface SendDanmakuPayload {
  content: DanmakuItem[];
}

// ── Socket.io 双向事件表 ───────────────────────
export interface ServerToClientEvents {
  receive_danmaku: (p: ReceiveDanmakuPayload) => void;
  revoke_danmaku: (p: RevokeDanmakuPayload) => void;
  quiz_update: (p: QuizUpdatePayload) => void;
  lottery_result: (p: LotteryWinner[]) => void;
}

export interface ClientToServerEvents {
  admin_control: (p: AdminAction) => void;
  send_danmaku: (p: SendDanmakuPayload) => void;
}
```

- [ ] **Step 2.2: Update root `tsconfig.json` to include `shared/`**

The current backend tsconfig has `"rootDir": "src"` and `"include": ["src"]`. Adding `shared/` requires dropping `rootDir` (TS will infer the common root as the project root, shifting outputs to `lib/src/` and `lib/shared/`).

Replace `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "outDir": "lib",
    "target": "es2022",
    "module": "commonjs",
    "declaration": true,
    "composite": true,
    "incremental": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "moduleResolution": "node",
    "jsx": "react-jsx",
    "jsxImportSource": "@satorijs/element",
    "types": [
      "node",
      "yml-register/types"
    ],
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["shared/*"]
    }
  },
  "include": ["src", "shared"]
}
```

- [ ] **Step 2.3: Update root `package.json` main/typings paths**

Because outputs now go to `lib/src/index.js`, update `package.json`:

```json
{
  ...
  "main": "lib/src/index.js",
  "typings": "lib/src/index.d.ts",
  ...
}
```

Keep `"files": ["lib", "dist", "public"]` unchanged — `lib/` still ships all compiled output.

- [ ] **Step 2.4: Verify backend typecheck**

```bash
npx tsc --noEmit -p .
```

Expected: no errors. The `shared/protocol.ts` file should be picked up.

- [ ] **Step 2.5: Verify frontend can resolve `@shared`**

Create a throwaway test by adding to `frontend/src/main.js` (still .js for now):

```js
// temp sanity check — remove after this step
import type { QuizStatus } from '@shared/protocol';  // skip if main is .js
```

Actually since main.js is still JS, do this verification in `frontend/src/App.vue`'s `<script>` block by temporarily adding `// @ts-check` and an import — OR simply run vue-tsc which will resolve the `@shared` alias in any imports it finds. Skip this step and rely on Task 4's verification.

- [ ] **Step 2.6: Commit**

```bash
git add shared/protocol.ts tsconfig.json package.json
git commit -m "feat(shared): add cross-cutting socket protocol types"
```

---

## Task 3: Backend — apply shared types to `src/index.ts`

**Files:**
- Modify: `src/index.ts`

**Constraint:** Type-only changes. Do not modify business logic, regex strings, prompts, or behavior. Any runtime check (`/^[ABCD]$/.test(arg)`, `parseInt(arg, 10)`) stays as-is.

- [ ] **Step 3.1: Add shared imports**

At the top of `src/index.ts`, add:

```ts
import type {
  AdminAction,
  ClientToServerEvents,
  LotteryWinner,
  QuizOption,
  QuizStatus,
  QuizUpdatePayload,
  ReceiveDanmakuPayload,
  RevokeDanmakuPayload,
  ServerToClientEvents,
} from "@shared/protocol";
import { QUIZ_OPTIONS } from "@shared/protocol";
```

(Keep the existing `import { Server } from "socket.io"` etc.)

- [ ] **Step 3.2: Type the Server and quizState**

Replace the inline type at the existing `QuizState` declaration:

```ts
type UserInfo = {
  id: string;
  name: string;
  avatar: string;
  answer: QuizOption;
};

type QuizState = {
  status: QuizStatus;
  votes: Map<string, UserInfo>;
  counts: Record<QuizOption, number>;
  correctAnswer: QuizOption | null;
};

let quizState: QuizState = {
  status: "idle",
  votes: new Map(),
  counts: { A: 0, B: 0, C: 0, D: 0 },
  correctAnswer: null,
};
```

Type `broadcastQuizUpdate`:

```ts
function broadcastQuizUpdate(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  const payload: QuizUpdatePayload = {
    status: quizState.status,
    counts: quizState.counts,
    total: quizState.votes.size,
    correctAnswer: quizState.correctAnswer,
  };
  io.emit("quiz_update", payload);
}
```

In `apply`, type the Server:

```ts
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});
```

- [ ] **Step 3.3: Type the `admin_control` handler using `AdminAction`**

Replace the existing `socket.on("admin_control", ...)` body. The `payload` is now typed as `AdminAction`:

```ts
socket.on("admin_control", (payload: AdminAction) => {
  logger.info(`Admin action received: ${payload.action}`);

  switch (payload.action) {
    case "start":
      quizState = {
        status: "active",
        votes: new Map(),
        counts: { A: 0, B: 0, C: 0, D: 0 },
        correctAnswer: null,
      };
      break;
    case "stop":
      quizState.status = "locked";
      break;
    case "answer":
      // discriminated union narrows payload.arg to QuizOption here
      if (/^[ABCD]$/.test(payload.arg)) {
        quizState.status = "revealed";
        quizState.correctAnswer = payload.arg;
      }
      break;
    case "reset":
      quizState.status = "idle";
      quizState.counts = { A: 0, B: 0, C: 0, D: 0 };
      break;
    case "draw": {
      if (!quizState.correctAnswer) return;
      const candidates = Array.from(quizState.votes.values()).filter(
        (u) => u.answer === quizState.correctAnswer
      );
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      const drawCount = Number.isFinite(payload.arg) ? payload.arg : 1;
      const winners: LotteryWinner[] = candidates.slice(0, drawCount);
      io.emit("lottery_result", winners);
      break;
    }
  }
  broadcastQuizUpdate(io);
});

// initial state push when client connects
socket.emit("quiz_update", {
  status: quizState.status,
  counts: quizState.counts,
  total: quizState.votes.size,
  correctAnswer: quizState.correctAnswer,
} satisfies QuizUpdatePayload);
```

- [ ] **Step 3.4: Type the message handler emissions**

In `ctx.on("message", ...)`, the `io.emit("receive_danmaku", ...)` call must conform to `ReceiveDanmakuPayload`:

```ts
const payload: ReceiveDanmakuPayload = {
  id: session.messageId,
  sender: { id: session.event.user.id, name: session.event.user.name },
  group: { id: session.event.channel.id },
  content,
  text,
  color,
};
io.emit("receive_danmaku", payload);
```

And in `ctx.on("message-deleted", ...)`:

```ts
const payload: RevokeDanmakuPayload = { id: messageId };
io.emit("revoke_danmaku", payload);
```

The `voting` block inside the message handler:

```ts
if (isQuizActive) {
  const cleanText = text.trim().toUpperCase();
  if (/^[ABCD]$/.test(cleanText)) {
    const option = cleanText as QuizOption;
    const userId = session.event.user.id;
    const previousVote = quizState.votes.get(userId)?.answer;
    if (previousVote) {
      quizState.counts[previousVote]--;
    }
    quizState.votes.set(userId, {
      id: userId,
      name: session.event.user.name || session.event.user.username || "神秘观众",
      avatar: session.event.user.avatar || "",
      answer: option,
    });
    quizState.counts[option]++;
    broadcastQuizUpdate(io);
    if (!config.showQuizAnswerDanmaku) return;
  }
}
```

The `parseMessage` function returns an untyped `content` array — leave it for now, but ensure its output assigns cleanly to `DanmakuItem[]` when emitted. If TS errors, narrow the type inside `parseMessage` to `DanmakuItem[]`.

- [ ] **Step 3.5: Verify backend typecheck**

```bash
npx tsc --noEmit -p .
```

Expected: no errors. If `parseMessage`'s return type fights with `DanmakuItem[]`, narrow the inner `.map<ParsedElement>(...)` to `.map<DanmakuItem>(...)` and adjust `ParsedElement` type accordingly (or remove it in favor of `DanmakuItem`).

- [ ] **Step 3.6: Commit**

```bash
git add src/index.ts
git commit -m "refactor(backend): adopt shared/protocol types (types only, no logic change)"
```

---

## Task 4: Migrate `main.js` → `main.ts` and add `lang="ts"` to App.vue

**Files:**
- Rename: `frontend/src/main.js` → `frontend/src/main.ts`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/index.html`

- [ ] **Step 4.1: Rename `main.js` → `main.ts`**

Content stays the same:

```ts
import { createApp } from 'vue';
import 'normalize.css';
import './style.css';
import App from './App.vue';

createApp(App).mount('#app');
```

- [ ] **Step 4.2: Update `frontend/index.html` script reference**

Change `<script type="module" src="/src/main.js">` to `<script type="module" src="/src/main.ts">`.

- [ ] **Step 4.3: Update App.vue script tag**

Change `<script setup>` to `<script setup lang="ts">`. Add type imports at the top:

```ts
import Danmaku from "danmaku";
import { nextTick, onMounted, ref } from "vue";
import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  ReceiveDanmakuPayload,
  RevokeDanmakuPayload,
  QuizUpdatePayload,
  LotteryWinner,
  QuizOption,
  QuizStatus,
  AdminAction,
} from "@shared/protocol";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
```

Then add types to existing state:

```ts
const isAdmin = ref<boolean>(false);
const quizStatus = ref<QuizStatus>("idle");
const quizCounts = ref<Record<QuizOption, number>>({ A: 0, B: 0, C: 0, D: 0 });
const quizTotal = ref<number>(0);
const correctAnswer = ref<QuizOption | null>(null);
const quizVisible = ref<boolean>(false);
const timerDuration = ref<number>(30);
const timerKey = ref<number>(0);
const drawCount = ref<number>(1);
const winners = ref<LotteryWinner[]>([]);
const showWinners = ref<boolean>(false);

let socket: AppSocket | null = null;
const isDebug = import.meta.env.DEV;
```

Type the function signatures (no logic change):

```ts
const getPercentNum = (option: QuizOption): number => { /* unchanged body */ };
const sendDanmaku = (text: string): void => { /* unchanged body */ };
const createTextElement = (text: string): HTMLSpanElement => { /* unchanged */ };
const createFaceElement = (src: string, name: string): HTMLImageElement => { /* unchanged */ };
const adminAction = (action: AdminAction['action'], arg: any = null): void => { /* unchanged body */ };
```

(The `adminAction` signature will be tightened in Task 7 when it moves into `useQuiz`. Leaving `any` for `arg` is acceptable in this intermediate state.)

- [ ] **Step 4.4: Verify typecheck and runtime**

```bash
cd frontend
npx vue-tsc --noEmit
npm run build
npm run dev
```

Browser: open dev URL, confirm:
- Default view loads (no JS errors in console)
- DEV mode "Test" button shows in top-left and sends a danmaku
- Open with `?role=admin` and verify admin panel renders

- [ ] **Step 4.5: Commit**

```bash
git add frontend/src/main.ts frontend/index.html frontend/src/App.vue
git rm frontend/src/main.js
git commit -m "refactor(frontend): migrate entry and App.vue to TypeScript"
```

---

## Task 5: Install Vitest and prepare test infra

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/__tests__/.gitkeep` (empty)

- [ ] **Step 5.1: Install Vitest**

```bash
cd frontend
npm install --save-dev vitest
```

- [ ] **Step 5.2: Create `frontend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5.3: Add test scripts to `frontend/package.json`**

Under `"scripts"`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 5.4: Verify Vitest runs**

```bash
cd frontend
npm test
```

Expected: "No test files found" or similar — Vitest exits cleanly with no tests yet.

- [ ] **Step 5.5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts
git commit -m "build(frontend): add Vitest"
```

---

## Task 6: Extract `useSocket` composable

**Files:**
- Create: `frontend/src/composables/useSocket.ts`
- Modify: `frontend/src/App.vue`

- [ ] **Step 6.1: Create `frontend/src/composables/useSocket.ts`**

```ts
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/protocol';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let _socket: AppSocket | null = null;

export function useSocket(): AppSocket {
  if (!_socket) {
    _socket = io() as AppSocket;
  }
  return _socket;
}
```

- [ ] **Step 6.2: Replace `socket` setup in App.vue with `useSocket()`**

In App.vue, remove `let socket: AppSocket | null = null;` and the `socket = io();` line inside `onMounted`. Replace with:

```ts
import { useSocket } from '@/composables/useSocket';

const socket = useSocket();
```

Inside `onMounted` (still present from before), remove the `socket = io();` line and the `nextTick(() => {})` wrap is no longer strictly needed for socket setup but **keep `nextTick`** because it currently delays Danmaku construction until the DOM is mounted; do not touch that yet. Just remove the `socket = io()` line.

All `socket.on(...)`, `socket.emit(...)` calls continue to work because `socket` is the same value, now from the composable.

- [ ] **Step 6.3: Verify**

```bash
cd frontend
npx vue-tsc --noEmit
npm run dev
```

Browser: confirm danmaku messages still flow; admin actions still work.

- [ ] **Step 6.4: Commit**

```bash
git add frontend/src/composables/useSocket.ts frontend/src/App.vue
git commit -m "refactor(frontend): extract useSocket composable"
```

---

## Task 7: Extract `useQuiz` composable + `computePercent` + tests (TDD)

**Files:**
- Create: `frontend/src/constants/quiz.ts`
- Create: `frontend/src/composables/useQuiz.ts`
- Create: `frontend/src/__tests__/useQuiz.test.ts`
- Modify: `frontend/src/App.vue`

- [ ] **Step 7.1: Create `frontend/src/constants/quiz.ts`**

```ts
import type { QuizOption } from '@shared/protocol';

export { QUIZ_OPTIONS } from '@shared/protocol';
export type { QuizOption } from '@shared/protocol';

export const TIMER_PRESETS = [15, 30, 60] as const;
export type TimerPreset = (typeof TIMER_PRESETS)[number];
```

- [ ] **Step 7.2: Write the failing test for `computePercent`**

Create `frontend/src/__tests__/useQuiz.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computePercent } from '@/composables/useQuiz';
import type { QuizOption, QuizStatus } from '@shared/protocol';

const emptyCounts: Record<QuizOption, number> = { A: 0, B: 0, C: 0, D: 0 };

const make = (overrides: {
  counts?: Record<QuizOption, number>;
  total?: number;
  status?: QuizStatus;
  correctAnswer?: QuizOption | null;
  option?: QuizOption;
}) => ({
  counts: overrides.counts ?? emptyCounts,
  total: overrides.total ?? 0,
  status: (overrides.status ?? 'active') as QuizStatus,
  correctAnswer: overrides.correctAnswer ?? null,
  option: (overrides.option ?? 'A') as QuizOption,
});

describe('computePercent', () => {
  it('returns 0 when total is 0 and not revealed', () => {
    expect(computePercent(make({ total: 0, status: 'active' }))).toBe(0);
    expect(computePercent(make({ total: 0, status: 'idle' }))).toBe(0);
    expect(computePercent(make({ total: 0, status: 'locked' }))).toBe(0);
  });

  it('returns 15 when total is 0, revealed, and option is the correct answer', () => {
    expect(
      computePercent(make({ total: 0, status: 'revealed', correctAnswer: 'A', option: 'A' }))
    ).toBe(15);
  });

  it('returns 0 when total is 0, revealed, but option is not the correct answer', () => {
    expect(
      computePercent(make({ total: 0, status: 'revealed', correctAnswer: 'A', option: 'B' }))
    ).toBe(0);
  });

  it('returns the raw percentage when active', () => {
    expect(
      computePercent(
        make({
          counts: { A: 3, B: 0, C: 0, D: 0 },
          total: 10,
          status: 'active',
          option: 'A',
        })
      )
    ).toBe(30);
  });

  it('rounds to 0.1 precision', () => {
    expect(
      computePercent(
        make({
          counts: { A: 1, B: 0, C: 0, D: 0 },
          total: 3,
          status: 'active',
          option: 'A',
        })
      )
    ).toBe(33.3);
  });

  it('bumps the winner to 12 when revealed and below the floor', () => {
    expect(
      computePercent(
        make({
          counts: { A: 7, B: 93, C: 0, D: 0 },
          total: 100,
          status: 'revealed',
          correctAnswer: 'A',
          option: 'A',
        })
      )
    ).toBe(12);
  });

  it('leaves the winner alone when revealed and already above the floor', () => {
    expect(
      computePercent(
        make({
          counts: { A: 33, B: 67, C: 0, D: 0 },
          total: 100,
          status: 'revealed',
          correctAnswer: 'A',
          option: 'A',
        })
      )
    ).toBe(33);
  });

  it('does not apply the floor to non-winner options when revealed', () => {
    expect(
      computePercent(
        make({
          counts: { A: 7, B: 93, C: 0, D: 0 },
          total: 100,
          status: 'revealed',
          correctAnswer: 'A',
          option: 'B',
        })
      )
    ).toBe(93);
  });
});
```

- [ ] **Step 7.3: Run test to verify it fails**

```bash
cd frontend
npm test
```

Expected: FAIL — `computePercent` is not exported from `@/composables/useQuiz` (file does not exist yet).

- [ ] **Step 7.4: Create `frontend/src/composables/useQuiz.ts`**

```ts
import { ref, computed } from 'vue';
import type {
  AdminAction,
  QuizOption,
  QuizStatus,
  QuizUpdatePayload,
} from '@shared/protocol';
import { useSocket } from './useSocket';

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

export function useQuiz() {
  const socket = useSocket();

  const status = ref<QuizStatus>('idle');
  const counts = ref<Record<QuizOption, number>>({ A: 0, B: 0, C: 0, D: 0 });
  const total = ref<number>(0);
  const correctAnswer = ref<QuizOption | null>(null);
  const timerDuration = ref<number>(30);
  const timerKey = ref<number>(0);

  const visible = computed(() => status.value !== 'idle');

  socket.on('quiz_update', (p: QuizUpdatePayload) => {
    status.value = p.status;
    counts.value = p.counts;
    total.value = p.total;
    correctAnswer.value = p.correctAnswer;
  });

  function getPercent(option: QuizOption): number {
    return computePercent({
      counts: counts.value,
      total: total.value,
      status: status.value,
      correctAnswer: correctAnswer.value,
      option,
    });
  }

  function sendAdmin(payload: AdminAction): void {
    if (payload.action === 'start') {
      timerKey.value++;
    }
    socket.emit('admin_control', payload);
  }

  return {
    status,
    counts,
    total,
    correctAnswer,
    timerDuration,
    timerKey,
    visible,
    getPercent,
    sendAdmin,
  };
}
```

- [ ] **Step 7.5: Run test to verify it passes**

```bash
cd frontend
npm test
```

Expected: PASS — all 8 cases green.

- [ ] **Step 7.6: Replace quiz state in App.vue with `useQuiz()`**

In App.vue:

1. Remove these refs: `quizStatus`, `quizCounts`, `quizTotal`, `correctAnswer`, `quizVisible`, `timerDuration`, `timerKey`.
2. Remove `getPercentNum` function.
3. Remove the `socket.on('quiz_update', ...)` listener inside `onMounted` (now handled in `useQuiz`).
4. Remove the `adminAction` function entirely.
5. Add at top of `<script setup>`:

```ts
import { useQuiz } from '@/composables/useQuiz';

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
```

6. In the template, replace every `adminAction('start')` / `adminAction('stop')` / `adminAction('reset')` with `sendAdmin({ action: 'start' })` / `sendAdmin({ action: 'stop' })` / `sendAdmin({ action: 'reset' })`.
7. Replace `adminAction('answer', opt)` with `sendAdmin({ action: 'answer', arg: opt })`.
8. Replace `adminAction('draw', drawCount)` with `sendAdmin({ action: 'draw', arg: drawCount })`.

Note: the v-for over `['A', 'B', 'C', 'D']` in the template should use `QUIZ_OPTIONS` imported from `@/constants/quiz`. Add import and replace:

```vue
<script setup lang="ts">
import { QUIZ_OPTIONS } from '@/constants/quiz';
</script>

<template>
  <div v-for="opt in QUIZ_OPTIONS" :key="opt" ...>
</template>
```

The `adminAction` lottery-reset side effect (`winners.value = []; showWinners.value = false`) is still inline in App.vue for now — Task 8 moves it to `useLottery`. **Leave the inline lottery clearing in App.vue for now** so behavior stays identical. Specifically, App.vue keeps its own `winners` / `showWinners` refs and its own `socket.on('lottery_result', ...)` / lottery-clear-on-quiz-status logic for one more task.

Wait — but `quiz_update` listener moved into `useQuiz`. The lottery-clear-on-idle/active logic in App.vue depended on its own `quiz_update` listener. Resolve this by keeping the App.vue listener too:

```ts
const socket = useSocket();
socket.on('quiz_update', (data) => {
  if (data.status === 'idle' || data.status === 'active') {
    showWinners.value = false;
  }
});
```

Both listeners (useQuiz's and App.vue's) will fire — socket.io supports multiple listeners on the same event. This is the bridge state until Task 8.

Also keep the `winners.value = []; showWinners.value = false` reset on `start` and `reset`. Since `adminAction` is gone, wrap `sendAdmin` in a local helper for App.vue:

```ts
function adminActionWithLotteryReset(payload: AdminAction) {
  if (payload.action === 'start' || payload.action === 'reset') {
    winners.value = [];
    showWinners.value = false;
  }
  sendAdmin(payload);
}
```

Use `adminActionWithLotteryReset` in template for start/reset buttons; use plain `sendAdmin` for stop/answer/draw.

- [ ] **Step 7.7: Verify**

```bash
cd frontend
npx vue-tsc --noEmit
npm test
npm run dev
```

Browser smoke: admin start → vote A/B/C/D → stop → answer → draw → reset. All UI behaves identically to before.

- [ ] **Step 7.8: Commit**

```bash
git add frontend/src/constants/quiz.ts frontend/src/composables/useQuiz.ts frontend/src/__tests__/useQuiz.test.ts frontend/src/App.vue
git commit -m "refactor(frontend): extract useQuiz composable with computePercent tests"
```

---

## Task 8: Extract `useLottery` composable + tests (TDD)

**Files:**
- Create: `frontend/src/composables/useLottery.ts`
- Create: `frontend/src/__tests__/useLottery.test.ts`
- Create: `frontend/src/__tests__/mockSocket.ts`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/composables/useSocket.ts`

- [ ] **Step 8.1: Create `frontend/src/__tests__/mockSocket.ts`**

```ts
import { vi } from 'vitest';
import type { AppSocket } from '@/composables/useSocket';

type Handler = (...args: any[]) => void;

export function createMockSocket() {
  const handlers = new Map<string, Set<Handler>>();

  const socket = {
    on: vi.fn((event: string, handler: Handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return socket;
    }),
    off: vi.fn((event: string, handler: Handler) => {
      handlers.get(event)?.delete(handler);
      return socket;
    }),
    emit: vi.fn(() => socket),
  } as unknown as AppSocket;

  function trigger(event: string, ...args: any[]) {
    handlers.get(event)?.forEach((h) => h(...args));
  }

  return { socket, trigger, handlers };
}
```

- [ ] **Step 8.2: Make `useSocket` injectable for tests**

Modify `frontend/src/composables/useSocket.ts` to expose an internal setter for tests:

```ts
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/protocol';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let _socket: AppSocket | null = null;

export function useSocket(): AppSocket {
  if (!_socket) {
    _socket = io() as AppSocket;
  }
  return _socket;
}

// Test-only: allow tests to inject a mock socket.
// Do not call from production code.
export function __setSocketForTesting(s: AppSocket | null): void {
  _socket = s;
}
```

- [ ] **Step 8.3: Write the failing test for `useLottery`**

Create `frontend/src/__tests__/useLottery.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useLottery } from '@/composables/useLottery';
import { __setSocketForTesting } from '@/composables/useSocket';
import { createMockSocket } from './mockSocket';
import type { LotteryWinner, QuizUpdatePayload } from '@shared/protocol';

const sampleWinners: LotteryWinner[] = [
  { id: 'u1', name: 'Alice', avatar: '', answer: 'A' },
  { id: 'u2', name: 'Bob', avatar: '', answer: 'A' },
];

const update = (status: QuizUpdatePayload['status']): QuizUpdatePayload => ({
  status,
  counts: { A: 0, B: 0, C: 0, D: 0 },
  total: 0,
  correctAnswer: null,
});

describe('useLottery visibility state machine', () => {
  let mock: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mock = createMockSocket();
    __setSocketForTesting(mock.socket);
  });

  afterEach(() => {
    __setSocketForTesting(null);
  });

  it('starts hidden with no winners', () => {
    const { winners, visible } = useLottery();
    expect(winners.value).toEqual([]);
    expect(visible.value).toBe(false);
  });

  it('shows winners when lottery_result fires', () => {
    const { winners, visible } = useLottery();
    mock.trigger('lottery_result', sampleWinners);
    expect(winners.value).toEqual(sampleWinners);
    expect(visible.value).toBe(true);
  });

  it('hides on quiz_update -> idle', () => {
    const { visible } = useLottery();
    mock.trigger('lottery_result', sampleWinners);
    mock.trigger('quiz_update', update('idle'));
    expect(visible.value).toBe(false);
  });

  it('hides on quiz_update -> active', () => {
    const { visible } = useLottery();
    mock.trigger('lottery_result', sampleWinners);
    mock.trigger('quiz_update', update('active'));
    expect(visible.value).toBe(false);
  });

  it('stays visible on quiz_update -> locked', () => {
    const { visible } = useLottery();
    mock.trigger('lottery_result', sampleWinners);
    mock.trigger('quiz_update', update('locked'));
    expect(visible.value).toBe(true);
  });

  it('stays visible on quiz_update -> revealed', () => {
    const { visible } = useLottery();
    mock.trigger('lottery_result', sampleWinners);
    mock.trigger('quiz_update', update('revealed'));
    expect(visible.value).toBe(true);
  });

  it('full sequence: idle -> draw -> locked stays visible', () => {
    const { visible } = useLottery();
    mock.trigger('quiz_update', update('idle'));
    mock.trigger('lottery_result', sampleWinners);
    mock.trigger('quiz_update', update('locked'));
    expect(visible.value).toBe(true);
  });
});
```

- [ ] **Step 8.4: Run test to verify it fails**

```bash
cd frontend
npm test
```

Expected: FAIL — `useLottery` not found.

- [ ] **Step 8.5: Create `frontend/src/composables/useLottery.ts`**

```ts
import { ref } from 'vue';
import type { LotteryWinner, QuizUpdatePayload } from '@shared/protocol';
import { useSocket } from './useSocket';

export function useLottery() {
  const socket = useSocket();
  const winners = ref<LotteryWinner[]>([]);
  const visible = ref<boolean>(false);

  socket.on('lottery_result', (list: LotteryWinner[]) => {
    winners.value = list;
    visible.value = true;
  });

  socket.on('quiz_update', (p: QuizUpdatePayload) => {
    if (p.status === 'idle' || p.status === 'active') {
      visible.value = false;
    }
  });

  return { winners, visible };
}
```

- [ ] **Step 8.6: Run test to verify it passes**

```bash
cd frontend
npm test
```

Expected: PASS — 7 lottery cases + 8 quiz cases all green.

- [ ] **Step 8.7: Replace lottery state in App.vue with `useLottery()`**

In App.vue:

1. Remove `winners` and `showWinners` refs.
2. Remove the `socket.on('lottery_result', ...)` listener.
3. Remove the App.vue-local `socket.on('quiz_update', ...)` lottery-clear listener (now in `useLottery`).
4. Remove the `winners.value = []; showWinners.value = false` lines from `adminActionWithLotteryReset` — and replace that helper with plain `sendAdmin`. (Lottery now self-manages.)
5. Add:

```ts
import { useLottery } from '@/composables/useLottery';

const { winners, visible: showWinners } = useLottery();
```

6. Template's `v-if="showWinners && winners.length > 0"` continues to work.

- [ ] **Step 8.8: Verify**

```bash
cd frontend
npx vue-tsc --noEmit
npm test
npm run dev
```

Browser smoke (admin role): start → vote → answer → draw → see winners → reset → winners disappear → start new round → ensure no stale winners.

- [ ] **Step 8.9: Commit**

```bash
git add frontend/src/composables/useLottery.ts frontend/src/composables/useSocket.ts frontend/src/__tests__/useLottery.test.ts frontend/src/__tests__/mockSocket.ts frontend/src/App.vue
git commit -m "refactor(frontend): extract useLottery composable with state machine tests"
```

---

## Task 9: Extract `useDanmaku` composable

**Files:**
- Create: `frontend/src/composables/useDanmaku.ts`
- Modify: `frontend/src/App.vue`

- [ ] **Step 9.1: Create `frontend/src/composables/useDanmaku.ts`**

```ts
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
      container.appendChild(createFaceElement(item.src, item.name));
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
```

- [ ] **Step 9.2: Replace danmaku setup in App.vue**

In App.vue:

1. Remove `import Danmaku from "danmaku";`
2. Remove `createTextElement`, `createFaceElement`.
3. Remove the `socket.on('receive_danmaku', ...)` and `socket.on('revoke_danmaku', ...)` listeners inside `onMounted`.
4. Remove the `new Danmaku({ ... })` construction.
5. The `nextTick` wrapper can now be removed entirely.
6. Add:

```ts
import { onBeforeUnmount, useTemplateRef } from 'vue';
import { useDanmaku } from '@/composables/useDanmaku';

const danmakuContainerRef = useTemplateRef<HTMLDivElement>('danmakuContainer');
const { mount: mountDanmaku, destroy: destroyDanmaku } = useDanmaku();

onMounted(() => {
  // existing role-detection logic stays
  const params = new URLSearchParams(window.location.search);
  if (params.get("role") === "admin") isAdmin.value = true;

  if (danmakuContainerRef.value) {
    mountDanmaku(danmakuContainerRef.value);
  }
});

onBeforeUnmount(() => {
  destroyDanmaku();
});
```

7. In the template, change `<div id="my-container"></div>` to:

```vue
<div id="my-container" ref="danmakuContainer"></div>
```

(Task 1 bumped Vue to 3.5+, so `useTemplateRef` is available. The string `'danmakuContainer'` passed to `useTemplateRef` must match the `ref="..."` attribute in the template exactly.)

- [ ] **Step 9.3: Verify**

```bash
cd frontend
npx vue-tsc --noEmit
npm run dev
```

Browser: send a danmaku via the DEV "Test" button, confirm rendering. Trigger a real message from QQ if possible, or use the test button. Then test message-deleted by deleting a QQ message and confirm fade+remove.

- [ ] **Step 9.4: Commit**

```bash
git add frontend/src/composables/useDanmaku.ts frontend/src/App.vue
git commit -m "refactor(frontend): extract useDanmaku composable"
```

---

## Task 10: Extract `useAdminRole` composable

**Files:**
- Create: `frontend/src/composables/useAdminRole.ts`
- Modify: `frontend/src/App.vue`

- [ ] **Step 10.1: Create `frontend/src/composables/useAdminRole.ts`**

```ts
export function useAdminRole(): { isAdmin: boolean } {
  const isAdmin = new URLSearchParams(window.location.search).get('role') === 'admin';
  return { isAdmin };
}
```

- [ ] **Step 10.2: Replace in App.vue**

In App.vue:

1. Remove `const isAdmin = ref<boolean>(false);`.
2. Remove the URLSearchParams role-detect logic inside `onMounted`.
3. Add at top:

```ts
import { useAdminRole } from '@/composables/useAdminRole';

const { isAdmin } = useAdminRole();
```

4. Template references to `isAdmin` remain unchanged (now plain boolean, not ref — Vue unwraps refs in template only, so check: `isAdmin` was a ref in `<template>`, now it's a plain bool. This works identically in `<template>` because Vue accesses it the same way. In `<script>` code, replace `isAdmin.value` with `isAdmin`).

- [ ] **Step 10.3: Verify**

```bash
cd frontend
npx vue-tsc --noEmit
npm run dev
```

Browser: load default URL (no admin panel) and load `?role=admin` URL (admin panel shows).

- [ ] **Step 10.4: Commit**

```bash
git add frontend/src/composables/useAdminRole.ts frontend/src/App.vue
git commit -m "refactor(frontend): extract useAdminRole composable"
```

---

## Task 11: Set up `styles/base.css` and global structural styles

**Files:**
- Create: `frontend/src/styles/base.css`
- Modify: `frontend/src/main.ts`
- Modify: `frontend/src/style.css` (will remain temporarily; gets shrunk in subsequent tasks)

- [ ] **Step 11.1: Create `frontend/src/styles/base.css`**

```css
/* Global structural styles — keep minimal.
 * Imperative DOM created by the danmaku library cannot be reached by Vue's
 * scoped selectors, so .danmaku-item / .danmaku-text / .danmaku-face must
 * live here.
 */

html,
body {
  background: transparent !important;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: "HarmonyOS Sans SC", "Helvetica Neue", "PingFang SC",
    "Microsoft YaHei", sans-serif;
}

#my-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
  padding: 4px;
}

.danmaku-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  color: white;
  font-family: "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", "SimHei",
    sans-serif;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  transition: opacity 0.2s ease;
}

.danmaku-text {
  font-size: 24px;
  font-weight: bold;
  text-shadow: 2px 2px 2px black;
  line-height: 24px;
}

.danmaku-face {
  width: 24px;
  height: 24px;
}
```

- [ ] **Step 11.2: Update `frontend/src/main.ts` import**

```ts
import { createApp } from 'vue';
import 'normalize.css';
import '@/styles/base.css';
import App from './App.vue';

createApp(App).mount('#app');
```

Keep the import of the old `./style.css` for now — remove it in the next step.

Actually: keep BOTH imports during transition:

```ts
import '@/styles/base.css';
import './style.css';
```

After all component-extraction tasks (Task 12–22) the second import goes away in Task 23.

- [ ] **Step 11.3: Remove globals now duplicated in `base.css` from `style.css`**

Open `frontend/src/style.css` and **delete** the existing top block (lines 1–24 in the original, covering `html, body`, `#my-container`, `.danmaku-item` shared rule) AND the bottom block (lines 443–460, covering `.danmaku-item` flex/color rule, `.danmaku-text`, `.danmaku-face`).

Leave all other rules in `style.css` untouched.

- [ ] **Step 11.4: Verify**

```bash
cd frontend
npm run dev
```

Browser: confirm danmaku still renders correctly with proper styling; quiz bar / lottery bar / admin panel still look identical.

- [ ] **Step 11.5: Commit**

```bash
git add frontend/src/styles/base.css frontend/src/main.ts frontend/src/style.css
git commit -m "style(frontend): introduce base.css for global imperative-DOM styles"
```

---

## Task 12: Extract `DevDebugBar.vue`

**Files:**
- Create: `frontend/src/components/DevDebugBar.vue`
- Modify: `frontend/src/App.vue`

- [ ] **Step 12.1: Create `frontend/src/components/DevDebugBar.vue`**

```vue
<script setup lang="ts">
import { useSocket } from '@/composables/useSocket';

const socket = useSocket();

function sendTestDanmaku() {
  socket.emit('send_danmaku', {
    content: [{ type: 'text', content: 'Hello' }],
  });
}
</script>

<template>
  <div class="dev-debug-bar">
    <button @click="sendTestDanmaku">Test</button>
  </div>
</template>

<style scoped>
.dev-debug-bar {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10001;
}
</style>
```

- [ ] **Step 12.2: Replace in App.vue**

In App.vue:

1. Remove the `<template v-if="isDebug">` block from template.
2. Remove `sendDanmaku` function from script.
3. Remove `const isDebug = import.meta.env.DEV;`.
4. Add to imports:

```ts
import DevDebugBar from '@/components/DevDebugBar.vue';
const isDev = import.meta.env.DEV;
```

5. Add to template (top):

```vue
<DevDebugBar v-if="isDev" />
```

- [ ] **Step 12.3: Verify**

```bash
cd frontend
npx vue-tsc --noEmit
npm run dev
```

Browser: DEV mode Test button still works.

- [ ] **Step 12.4: Commit**

```bash
git add frontend/src/components/DevDebugBar.vue frontend/src/App.vue
git commit -m "refactor(frontend): extract DevDebugBar component"
```

---

## Task 13: Extract `DanmakuLayer.vue`

**Files:**
- Create: `frontend/src/components/DanmakuLayer.vue`
- Modify: `frontend/src/App.vue`

- [ ] **Step 13.1: Create `frontend/src/components/DanmakuLayer.vue`**

```vue
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

<!-- No scoped styles. #my-container is in base.css because the danmaku
     library injects imperative DOM that scoped selectors can't reach. -->
```

- [ ] **Step 13.2: Replace in App.vue**

In App.vue:

1. Remove `danmakuContainerRef`, `mountDanmaku`, `destroyDanmaku` from script.
2. Remove the `onMounted` body that mounts danmaku and the `onBeforeUnmount` that destroys it. (The `onMounted` may no longer be needed at all if Task 10 already removed the role logic. Check and remove the import if empty.)
3. Remove the `<div id="my-container">` from template.
4. Add imports:

```ts
import DanmakuLayer from '@/components/DanmakuLayer.vue';
```

5. Add to template:

```vue
<DanmakuLayer />
```

- [ ] **Step 13.3: Verify**

```bash
cd frontend
npx vue-tsc --noEmit
npm run dev
```

Browser: send a test danmaku; revoke a danmaku; both work.

- [ ] **Step 13.4: Commit**

```bash
git add frontend/src/components/DanmakuLayer.vue frontend/src/App.vue
git commit -m "refactor(frontend): extract DanmakuLayer component"
```

---

## Task 14: Extract `lottery/LotteryWinnerCard.vue`

**Files:**
- Create: `frontend/src/components/lottery/LotteryWinnerCard.vue`

- [ ] **Step 14.1: Create `frontend/src/components/lottery/LotteryWinnerCard.vue`**

```vue
<script setup lang="ts">
import type { LotteryWinner } from '@shared/protocol';

const props = defineProps<{
  winner: LotteryWinner;
  index: number;
}>();
</script>

<template>
  <div
    class="flat-winner-card"
    :style="{ animationDelay: index * 0.1 + 's' }"
  >
    <div class="sq-avatar">
      <img :src="winner.avatar" onerror="this.style.opacity=0" />
    </div>
    <div class="sq-info">
      <div class="sq-name">{{ winner.name }}</div>
      <div class="sq-id">ID: {{ winner.id }}</div>
    </div>
  </div>
</template>

<style scoped>
.flat-winner-card {
  display: flex;
  align-items: center;
  margin-right: 30px;
  background: #1a1a1a;
  padding: 0 15px 0 0;
  height: 50px;
  opacity: 0;
  animation: slideInRight 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  border-left: 4px solid #ffd700;
}

.sq-avatar {
  width: 50px;
  height: 50px;
  background: #333;
  margin-right: 10px;
  overflow: hidden;
}
.sq-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sq-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.sq-name {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  font-family: "Microsoft YaHei", sans-serif;
  line-height: 1.2;
}
.sq-id {
  color: #888;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
```

- [ ] **Step 14.2: Remove these rules from `frontend/src/style.css`**

Delete from `style.css`: `.flat-winner-card`, `.sq-avatar`, `.sq-avatar img`, `.sq-info`, `.sq-name`, `.sq-id`, `@keyframes slideInRight`.

- [ ] **Step 14.3: Commit (the component is not yet used; LotteryBar will use it in Task 15)**

```bash
git add frontend/src/components/lottery/LotteryWinnerCard.vue frontend/src/style.css
git commit -m "refactor(frontend): extract LotteryWinnerCard component"
```

---

## Task 15: Extract `lottery/LotteryBar.vue`

**Files:**
- Create: `frontend/src/components/lottery/LotteryBar.vue`
- Modify: `frontend/src/App.vue`

- [ ] **Step 15.1: Create `frontend/src/components/lottery/LotteryBar.vue`**

```vue
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
```

- [ ] **Step 15.2: Replace in App.vue**

In App.vue:

1. Remove the entire `<transition name="lottery-slide">...</transition>` block from template.
2. Remove the `useLottery()` call from script.
3. Add imports:

```ts
import LotteryBar from '@/components/lottery/LotteryBar.vue';
```

4. Add to template:

```vue
<LotteryBar />
```

- [ ] **Step 15.3: Remove these rules from `frontend/src/style.css`**

Delete from `style.css`: `.flat-lottery-bar`, `.lottery-header`, `.lottery-title`, `.lottery-subtitle`, `.lottery-list-track`, `.lottery-slide-enter-active`, `.lottery-slide-leave-active`, `.lottery-slide-enter-from`, `.lottery-slide-leave-to`.

- [ ] **Step 15.4: Verify**

```bash
cd frontend
npx vue-tsc --noEmit
npm run dev
```

Browser (admin): start → vote → answer → draw → confirm lottery bar slides in with winners; reset → confirm it slides out.

- [ ] **Step 15.5: Commit**

```bash
git add frontend/src/components/lottery/LotteryBar.vue frontend/src/App.vue frontend/src/style.css
git commit -m "refactor(frontend): extract LotteryBar component"
```

---

## Task 16: Extract `quiz/QuizTimer.vue` (leaf)

**Files:**
- Create: `frontend/src/components/quiz/QuizTimer.vue`

- [ ] **Step 16.1: Create `frontend/src/components/quiz/QuizTimer.vue`**

```vue
<script setup lang="ts">
const props = defineProps<{
  duration: number;
  running: boolean;
  restartKey: number;
}>();
</script>

<template>
  <div
    class="timer-border"
    :class="{ running }"
    :style="{ animationDuration: duration + 's' }"
    :key="restartKey"
  ></div>
</template>

<style scoped>
.timer-border {
  height: 6px;
  width: 100%;
  background: #ffffff;
  transform-origin: center;
  transform: scaleX(1);
}
.timer-border.running {
  animation: shrinkCenter linear forwards;
}
@keyframes shrinkCenter {
  from {
    transform: scaleX(1);
    background: #00ffaa;
  }
  50% {
    background: #ffee00;
  }
  to {
    transform: scaleX(0);
    background: #ff0044;
  }
}
</style>
```

- [ ] **Step 16.2: Remove from `style.css`**

Delete `.timer-border`, `.timer-border.running`, `@keyframes shrinkCenter`.

- [ ] **Step 16.3: Commit (used by QuizBar in Task 20)**

```bash
git add frontend/src/components/quiz/QuizTimer.vue frontend/src/style.css
git commit -m "refactor(frontend): extract QuizTimer component"
```

---

## Task 17: Extract `quiz/QuizStatusBadge.vue` (leaf)

**Files:**
- Create: `frontend/src/components/quiz/QuizStatusBadge.vue`

- [ ] **Step 17.1: Create `frontend/src/components/quiz/QuizStatusBadge.vue`**

```vue
<script setup lang="ts">
import type { QuizStatus } from '@shared/protocol';

defineProps<{ status: QuizStatus }>();
</script>

<template>
  <transition name="text-slide" mode="out-in">
    <span v-if="status === 'active'" class="status-badge live">● LIVE</span>
    <span v-else-if="status === 'locked'" class="status-badge locked">🔒 LOCKED</span>
    <span v-else-if="status === 'revealed'" class="status-badge result">🎉 RESULT</span>
    <span v-else class="status-badge ready">READY</span>
  </transition>
</template>

<style scoped>
.status-badge.live {
  color: #ff3366;
  animation: blink 1s infinite;
}
.status-badge.locked {
  color: #ffcc00;
}
.status-badge.result {
  color: #00ccff;
}
@keyframes blink {
  50% {
    opacity: 0.5;
  }
}
.text-slide-enter-active,
.text-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.text-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.text-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
```

- [ ] **Step 17.2: Remove from `style.css`**

Delete `.status-badge.live`, `.status-badge.locked`, `.status-badge.result`, `@keyframes blink`, `.text-slide-*`.

- [ ] **Step 17.3: Commit**

```bash
git add frontend/src/components/quiz/QuizStatusBadge.vue frontend/src/style.css
git commit -m "refactor(frontend): extract QuizStatusBadge component"
```

---

## Task 18: Extract `quiz/QuizInstruction.vue` (leaf)

**Files:**
- Create: `frontend/src/components/quiz/QuizInstruction.vue`

- [ ] **Step 18.1: Create `frontend/src/components/quiz/QuizInstruction.vue`**

```vue
<script setup lang="ts">
import type { QuizStatus, QuizOption } from '@shared/protocol';

defineProps<{
  status: QuizStatus;
  correctAnswer: QuizOption | null;
}>();
</script>

<template>
  <transition name="text-slide" mode="out-in">
    <div
      v-if="status === 'active' || status === 'idle'"
      key="tip-active"
      class="instruction-text"
    >
      发送弹幕 <span class="key-box">A</span>
      <span class="key-box">B</span> <span class="key-box">C</span>
      <span class="key-box">D</span> 抢答
    </div>
    <div v-else-if="status === 'locked'" key="tip-locked" class="instruction-text">
      ✋ 答题结束 · 等待揭晓
    </div>
    <div v-else key="tip-result" class="instruction-text">
      正确答案 <span class="key-box winner-key">{{ correctAnswer }}</span>
    </div>
  </transition>
</template>

<style scoped>
.instruction-text {
  font-family: "Microsoft YaHei", sans-serif;
  font-size: 15px;
  color: #ccc;
  white-space: nowrap;
}
.key-box {
  display: inline-block;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  padding: 0 6px;
  border-radius: 4px;
  font-family: "Impact", sans-serif;
  margin: 0 2px;
  line-height: 20px;
}
.key-box.winner-key {
  background: #ffd700;
  color: #000;
  padding: 0 8px;
  font-size: 16px;
}
.text-slide-enter-active,
.text-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.text-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.text-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
```

(Note: `.text-slide-*` transitions are duplicated between QuizStatusBadge and QuizInstruction because each uses its own scoped `<transition>`. Scoped CSS isolates them. Acceptable duplication.)

- [ ] **Step 18.2: Remove from `style.css`**

Delete `.instruction-text`, `.key-box`, `.key-box.winner-key`.

- [ ] **Step 18.3: Commit**

```bash
git add frontend/src/components/quiz/QuizInstruction.vue frontend/src/style.css
git commit -m "refactor(frontend): extract QuizInstruction component"
```

---

## Task 19: Extract `quiz/QuizChart.vue` (leaf)

**Files:**
- Create: `frontend/src/components/quiz/QuizChart.vue`

- [ ] **Step 19.1: Create `frontend/src/components/quiz/QuizChart.vue`**

```vue
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
```

- [ ] **Step 19.2: Remove from `style.css`**

Delete `.stacked-chart-track`, `.chart-segment`, `.chart-segment:last-child`, `.seg-a/b/c/d`, `.seg-content`, `.seg-label`, `.seg-data`, `.chart-segment.is-dimmed`, `.chart-segment.is-winner`, `.winner-check`, `.bounce-in-enter-active`, `@keyframes bounceIn`.

- [ ] **Step 19.3: Commit**

```bash
git add frontend/src/components/quiz/QuizChart.vue frontend/src/style.css
git commit -m "refactor(frontend): extract QuizChart component"
```

---

## Task 20: Extract `quiz/QuizBar.vue` (container)

**Files:**
- Create: `frontend/src/components/quiz/QuizBar.vue`
- Modify: `frontend/src/App.vue`

- [ ] **Step 20.1: Create `frontend/src/components/quiz/QuizBar.vue`**

```vue
<script setup lang="ts">
import { useQuiz } from '@/composables/useQuiz';
import QuizTimer from './QuizTimer.vue';
import QuizStatusBadge from './QuizStatusBadge.vue';
import QuizInstruction from './QuizInstruction.vue';
import QuizChart from './QuizChart.vue';

const props = defineProps<{
  adminView: boolean;
}>();

const {
  status,
  counts,
  total,
  correctAnswer,
  timerDuration,
  timerKey,
  visible,
  getPercent,
} = useQuiz();
</script>

<template>
  <transition name="slide-up">
    <div
      v-if="visible || adminView"
      class="flat-quiz-bar"
      :class="{ 'admin-view': adminView }"
    >
      <QuizTimer
        :duration="timerDuration"
        :running="status === 'active'"
        :restart-key="timerKey"
      />

      <div class="bar-info-grid">
        <div class="grid-left">
          <QuizStatusBadge :status="status" />
        </div>

        <div class="grid-center">
          <QuizInstruction :status="status" :correct-answer="correctAnswer" />
        </div>

        <div class="grid-right total-text">
          VOTES: <b>{{ total }}</b>
        </div>
      </div>

      <QuizChart
        :status="status"
        :counts="counts"
        :correct-answer="correctAnswer"
        :get-percent="getPercent"
      />
    </div>
  </transition>
</template>

<style scoped>
.flat-quiz-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 120px;
  z-index: 9999;
  background: #000000;
  display: flex;
  flex-direction: column;
  font-family: "Montserrat", "Impact", "Arial Black", sans-serif;
}
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(120%);
}

.bar-info-grid {
  height: 36px;
  display: grid;
  grid-template-columns: 120px 1fr 120px;
  align-items: center;
  padding: 0 20px;
  background: #1a1a1a;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  overflow: hidden;
}
.grid-left { text-align: left; }
.grid-center {
  text-align: center;
  display: flex;
  justify-content: center;
}
.grid-right { text-align: right; }
.total-text b {
  color: #ffd700;
}

.flat-quiz-bar.admin-view {
  transform-origin: bottom left;
  transform: scale(0.6) !important;
  bottom: 20px;
  left: 20px;
  width: 800px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}
</style>
```

- [ ] **Step 20.2: Replace in App.vue**

In App.vue:

1. Remove the entire `<transition name="slide-up">...</transition>` block including all quiz bar markup.
2. Remove all the `useQuiz` destructured refs (`quizStatus`, `quizCounts`, etc.) — they're now used inside QuizBar.
3. Remove `getPercentNum` if not used elsewhere (it isn't).
4. The `sendAdmin` and `QUIZ_OPTIONS` may still be used by admin template — leave them for Task 24.
5. Add import:

```ts
import QuizBar from '@/components/quiz/QuizBar.vue';
```

6. Add to template:

```vue
<QuizBar :admin-view="isAdmin" />
```

- [ ] **Step 20.3: Remove from `style.css`**

Delete `.flat-quiz-bar`, `.slide-up-*`, `.bar-info-grid`, `.grid-left`, `.grid-center`, `.grid-right`, `.total-text b`, `.admin-view.flat-quiz-bar`.

- [ ] **Step 20.4: Verify**

```bash
cd frontend
npx vue-tsc --noEmit
npm run dev
```

Browser smoke (admin): full quiz flow start → vote → stop → answer → draw → reset. All animations and styling preserved.

- [ ] **Step 20.5: Commit**

```bash
git add frontend/src/components/quiz/QuizBar.vue frontend/src/App.vue frontend/src/style.css
git commit -m "refactor(frontend): extract QuizBar container component"
```

---

## Task 21: Extract `admin/AdminTimerSelect.vue`, `AdminFlowControls.vue`, `AdminResultDraw.vue` (leaves)

**Files:**
- Create: `frontend/src/components/admin/AdminTimerSelect.vue`
- Create: `frontend/src/components/admin/AdminFlowControls.vue`
- Create: `frontend/src/components/admin/AdminResultDraw.vue`

- [ ] **Step 21.1: Create `frontend/src/components/admin/AdminTimerSelect.vue`**

```vue
<script setup lang="ts">
import { TIMER_PRESETS } from '@/constants/quiz';

const props = defineProps<{ duration: number }>();
const emit = defineEmits<{ 'update:duration': [value: number] }>();
</script>

<template>
  <div class="admin-group">
    <div class="label">1. 倒计时显示</div>
    <div class="btn-row">
      <button
        v-for="preset in TIMER_PRESETS"
        :key="preset"
        @click="emit('update:duration', preset)"
        :class="{ active: duration === preset }"
      >
        {{ preset }}s
      </button>
    </div>
  </div>
</template>

<style scoped>
.admin-group {
  margin-bottom: 15px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
.label {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
  font-weight: bold;
}
.btn-row {
  display: flex;
  gap: 5px;
}
button {
  flex: 1;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  background: #f9f9f9;
}
button.active {
  background: #333;
  color: white;
}
</style>
```

- [ ] **Step 21.2: Create `frontend/src/components/admin/AdminFlowControls.vue`**

```vue
<script setup lang="ts">
import type { QuizStatus, AdminAction } from '@shared/protocol';

const props = defineProps<{
  status: QuizStatus;
}>();
const emit = defineEmits<{ action: [payload: AdminAction] }>();
</script>

<template>
  <div class="admin-group">
    <div class="label">2. 流程控制</div>
    <div class="btn-row">
      <button
        @click="emit('action', { action: 'start' })"
        :disabled="status === 'active'"
        class="btn-primary"
      >
        ▶ 开始
      </button>
      <button
        @click="emit('action', { action: 'stop' })"
        :disabled="status !== 'active'"
        class="btn-warning"
      >
        ⏸ 锁榜
      </button>
      <button @click="emit('action', { action: 'reset' })" class="btn-danger">
        🔄 关闭
      </button>
    </div>
  </div>
</template>

<style scoped>
.admin-group {
  margin-bottom: 15px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
.label {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
  font-weight: bold;
}
.btn-row {
  display: flex;
  gap: 5px;
}
button {
  flex: 1;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}
.btn-primary {
  background: #007bff !important;
  color: white;
  border: none !important;
}
.btn-warning {
  background: #ffc107 !important;
  border: none !important;
}
.btn-danger {
  background: #dc3545 !important;
  color: white;
  border: none !important;
}
.btn-primary:disabled,
.btn-warning:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 21.3: Create `frontend/src/components/admin/AdminResultDraw.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import type { QuizStatus, AdminAction, QuizOption } from '@shared/protocol';
import { QUIZ_OPTIONS } from '@/constants/quiz';

const props = defineProps<{
  status: QuizStatus;
}>();
const emit = defineEmits<{ action: [payload: AdminAction] }>();

const drawCount = ref<number>(1);
</script>

<template>
  <div class="admin-group">
    <div class="label">3. 结果 & 抽奖</div>
    <div class="btn-row" style="margin-bottom: 8px">
      <button
        v-for="opt in QUIZ_OPTIONS"
        :key="opt"
        @click="emit('action', { action: 'answer', arg: opt })"
      >
        {{ opt }}
      </button>
    </div>
    <div class="label">幸运抽奖</div>
    <div class="btn-row">
      <input type="number" v-model="drawCount" min="1" class="admin-input" />
      <button
        @click="emit('action', { action: 'draw', arg: drawCount })"
        :disabled="status !== 'revealed'"
        class="btn-gold"
      >
        🎲 抽取 {{ drawCount }} 人
      </button>
    </div>
  </div>
</template>

<style scoped>
.admin-group {
  margin-bottom: 15px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
.admin-group:last-child {
  border-bottom: none;
}
.label {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
  font-weight: bold;
}
.btn-row {
  display: flex;
  gap: 5px;
}
button {
  flex: 1;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  background: #f9f9f9;
}
.admin-input {
  width: 50px;
  text-align: center;
  border: 1px solid #ddd;
  border-radius: 4px;
}
.btn-gold {
  background: linear-gradient(to bottom, #ffd700, #ffaa00) !important;
  color: black !important;
  border: none !important;
  font-weight: bold;
}
.btn-gold:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 21.4: Commit (these are used by AdminPanel in Task 22)**

```bash
git add frontend/src/components/admin/
git commit -m "refactor(frontend): extract admin leaf components"
```

---

## Task 22: Extract `admin/AdminPanel.vue` (container)

**Files:**
- Create: `frontend/src/components/admin/AdminPanel.vue`
- Modify: `frontend/src/App.vue`

- [ ] **Step 22.1: Create `frontend/src/components/admin/AdminPanel.vue`**

```vue
<script setup lang="ts">
import { useQuiz } from '@/composables/useQuiz';
import AdminTimerSelect from './AdminTimerSelect.vue';
import AdminFlowControls from './AdminFlowControls.vue';
import AdminResultDraw from './AdminResultDraw.vue';

const { status, timerDuration, sendAdmin } = useQuiz();

function onTimerDurationUpdate(v: number) {
  timerDuration.value = v;
}
</script>

<template>
  <div class="admin-panel">
    <h3>📺 场控台</h3>

    <AdminTimerSelect
      :duration="timerDuration"
      @update:duration="onTimerDurationUpdate"
    />

    <AdminFlowControls :status="status" @action="sendAdmin" />

    <AdminResultDraw :status="status" @action="sendAdmin" />
  </div>
</template>

<style scoped>
.admin-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #fff;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
  width: 220px;
  font-family: "Microsoft YaHei", sans-serif;
  z-index: 10000;
}
.admin-panel h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
}
</style>
```

The handler is defined in script:

```ts
function onTimerDurationUpdate(v: number) {
  timerDuration.value = v;
}
```

(`timerDuration` is a `Ref<number>` returned from `useQuiz()`; writes need `.value` in script context.)

- [ ] **Step 22.2: Replace in App.vue**

In App.vue:

1. Remove the entire `<div v-if="isAdmin" class="admin-panel">...</div>` block.
2. Remove anything else that was admin-specific from the script (`drawCount`, `sendAdmin`, `QUIZ_OPTIONS` import if no longer used).
3. Add import:

```ts
import AdminPanel from '@/components/admin/AdminPanel.vue';
```

4. Add to template:

```vue
<AdminPanel v-if="isAdmin" />
```

- [ ] **Step 22.3: Remove from `style.css`**

Delete `.admin-panel`, `.admin-group`, `.admin-group:last-child`, `.label`, `.btn-row`, `.admin-input`, `.admin-panel button`, `.admin-panel button.active`, `.btn-primary`, `.btn-warning`, `.btn-danger`, `.btn-gold`, `.btn-*:disabled`.

- [ ] **Step 22.4: Verify**

```bash
cd frontend
npx vue-tsc --noEmit
npm run dev
```

Browser (admin): all three admin sections render; timer button toggles active state; flow buttons disable per status; draw button disabled until revealed.

- [ ] **Step 22.5: Commit**

```bash
git add frontend/src/components/admin/AdminPanel.vue frontend/src/App.vue frontend/src/style.css
git commit -m "refactor(frontend): extract AdminPanel container component"
```

---

## Task 23: Delete legacy `style.css` and finalize App.vue

**Files:**
- Delete: `frontend/src/style.css`
- Modify: `frontend/src/main.ts`
- Modify: `frontend/src/App.vue`

- [ ] **Step 23.1: Inspect remaining `style.css`**

```bash
cat frontend/src/style.css
```

Expected: file is empty or contains only blank lines / comments. If any rules remain, they are orphans — either move them to the appropriate component or delete them if truly dead. If you find a non-trivial rule still in use, **stop and investigate** which component uses it before deleting.

- [ ] **Step 23.2: Delete `style.css` and its import**

```bash
git rm frontend/src/style.css
```

In `frontend/src/main.ts`, remove the line `import './style.css';`. Final state:

```ts
import { createApp } from 'vue';
import 'normalize.css';
import '@/styles/base.css';
import App from './App.vue';

createApp(App).mount('#app');
```

- [ ] **Step 23.3: Final App.vue should look like this**

```vue
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
```

If App.vue has any leftover imports or refs, remove them. Expected line count: ~15.

- [ ] **Step 23.4: Final full verification**

```bash
cd frontend
npx vue-tsc --noEmit
npm test
npm run build
npm run dev
```

Then in the browser, walk through the complete acceptance scenario:

1. Open `http://localhost:5173/` (or whatever Vite picks)
2. DEV "Test" button → danmaku appears in container
3. Open `http://localhost:5173/?role=admin`
4. Admin panel renders top-right with three groups
5. Click 15s — button highlights; click 30s — switches highlight
6. Click ▶ 开始 → timer animation runs; status badge shows ● LIVE blinking
7. Send "A" via QQ (or rapid emit from test button if you wire it up) → chart segment grows; VOTES count increments
8. Click ⏸ 锁榜 → status badge shows 🔒 LOCKED
9. Click answer "A" → status badge shows 🎉 RESULT; the 'A' segment grows with white border + check mark; other segments dim
10. Set抽奖人数 = 2, click 🎲 抽取 → lottery bar slides up with two winner cards
11. Click 🔄 关闭 → bars slide down; lottery disappears; everything clears
12. Trigger a message-deleted from backend → corresponding danmaku fades and removes

- [ ] **Step 23.5: Commit**

```bash
git add frontend/src/main.ts frontend/src/App.vue
git commit -m "refactor(frontend): delete legacy style.css and finalize App.vue shell"
```

---

## Task 24: Sweep — orphan removal & build script update

**Files:**
- Modify: `frontend/package.json` (verify build runs vue-tsc first)
- Verify no orphan files or imports remain

- [ ] **Step 24.1: Run an orphan check**

```bash
cd frontend
npx vue-tsc --noEmit
```

Look for warnings about unused imports or files. If any composable / component is unused, delete it.

```bash
grep -r "from '@/.*'" frontend/src
```

Skim each import — verify every imported symbol is referenced.

- [ ] **Step 24.2: Ensure `npm run build` runs typecheck**

In `frontend/package.json` confirm:

```json
"build": "vue-tsc --noEmit && vite build"
```

If missing, add it.

- [ ] **Step 24.3: Full verification matrix**

| Check | Command | Expected |
|---|---|---|
| Frontend types | `cd frontend && npx vue-tsc --noEmit` | exit 0 |
| Frontend tests | `cd frontend && npm test` | 15 tests pass (8 useQuiz + 7 useLottery) |
| Frontend build | `cd frontend && npm run build` | `../public/index.html` produced |
| Backend types | `npx tsc --noEmit -p .` from root | exit 0 |

- [ ] **Step 24.4: Final commit (if anything trimmed)**

If Step 24.1 or 24.2 produced changes:

```bash
git add -A
git commit -m "chore(frontend): final sweep — remove orphans"
```

Otherwise skip.

---

## Self-Review Checklist (already done by plan author)

**1. Spec coverage:**

| Spec section | Covered by |
|---|---|
| §3 File structure | Tasks 1, 2, 6-23 (every file created) |
| §4 shared/protocol.ts | Task 2 |
| §5.1 useSocket | Task 6 |
| §5.2 useQuiz + computePercent | Task 7 |
| §5.3 useLottery | Task 8 |
| §5.4 useDanmaku | Task 9 |
| §5.5 useAdminRole | Task 10 |
| §6 components | Tasks 12-22 |
| §7 CSS partition | Tasks 11, 14-22 (each component owns its CSS); Task 23 cleanup |
| §8 backend type alignment | Task 3 |
| §9 tests | Tasks 5, 7 (computePercent), 8 (useLottery) |
| §10 migration order | This plan's task ordering |

**2. Placeholder scan:** No TBDs/TODOs. Code snippets are complete.

**3. Type consistency:** `computePercent`, `useQuiz`, `useLottery`, `useDanmaku`, `useSocket` signatures consistent across tasks. `restartKey` vs `timerKey` mapping documented at Task 16/20. `QUIZ_OPTIONS` source consistent (`@/constants/quiz` re-exports from `@shared/protocol`).
