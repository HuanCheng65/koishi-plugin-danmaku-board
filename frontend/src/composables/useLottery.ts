import { ref, type Ref } from 'vue';
import type { LotteryWinner, QuizUpdatePayload } from '@shared/protocol';
import { useSocket } from './useSocket';

type LotteryState = {
  winners: Ref<LotteryWinner[]>;
  visible: Ref<boolean>;
};

let _state: LotteryState | null = null;

function createLottery(): LotteryState {
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

export function useLottery(): LotteryState {
  if (!_state) _state = createLottery();
  return _state;
}

// Test-only: reset the singleton between tests.
// Do not call from production code.
export function __resetLotteryForTesting(): void {
  _state = null;
}
