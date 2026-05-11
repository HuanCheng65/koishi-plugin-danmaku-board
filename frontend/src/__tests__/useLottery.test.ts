import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useLottery, __resetLotteryForTesting } from '@/composables/useLottery';
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
    __resetLotteryForTesting();
  });

  afterEach(() => {
    __setSocketForTesting(null);
    __resetLotteryForTesting();
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
