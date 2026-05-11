// ── 业务原子 ───────────────────────────────────
export type QuizStatus = 'idle' | 'active' | 'locked' | 'revealed';
export type QuizOption = 'A' | 'B' | 'C' | 'D';
export const QUIZ_OPTIONS = ['A', 'B', 'C', 'D'] as const satisfies readonly QuizOption[];

// ── 弹幕内容 ───────────────────────────────────
export type DanmakuItem =
  | { type: 'text'; content: string }
  | { type: 'face'; id?: number; name: string; src?: string };

// ── 事件 payload ───────────────────────────────
export interface ReceiveDanmakuPayload {
  id?: string;
  sender: { id: string; name?: string };
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
