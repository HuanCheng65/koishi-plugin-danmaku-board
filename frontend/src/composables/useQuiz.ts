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
