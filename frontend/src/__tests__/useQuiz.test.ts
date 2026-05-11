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
      computePercent(make({ counts: { A: 3, B: 0, C: 0, D: 0 }, total: 10, status: 'active', option: 'A' }))
    ).toBe(30);
  });

  it('rounds to 0.1 precision', () => {
    expect(
      computePercent(make({ counts: { A: 1, B: 0, C: 0, D: 0 }, total: 3, status: 'active', option: 'A' }))
    ).toBe(33.3);
  });

  it('bumps the winner to 12 when revealed and below the floor', () => {
    expect(
      computePercent(make({ counts: { A: 7, B: 93, C: 0, D: 0 }, total: 100, status: 'revealed', correctAnswer: 'A', option: 'A' }))
    ).toBe(12);
  });

  it('leaves the winner alone when revealed and already above the floor', () => {
    expect(
      computePercent(make({ counts: { A: 33, B: 67, C: 0, D: 0 }, total: 100, status: 'revealed', correctAnswer: 'A', option: 'A' }))
    ).toBe(33);
  });

  it('does not apply the floor to non-winner options when revealed', () => {
    expect(
      computePercent(make({ counts: { A: 7, B: 93, C: 0, D: 0 }, total: 100, status: 'revealed', correctAnswer: 'A', option: 'B' }))
    ).toBe(93);
  });

  it('rounds the winner percentage to 0.1 precision when above the floor', () => {
    expect(
      computePercent(
        make({
          counts: { A: 33, B: 64, C: 0, D: 0 },
          total: 97,
          status: 'revealed',
          correctAnswer: 'A',
          option: 'A',
        })
      )
    ).toBe(34);
  });
});
