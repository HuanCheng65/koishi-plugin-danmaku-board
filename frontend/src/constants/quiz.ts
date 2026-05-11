import type { QuizOption } from '@shared/protocol';

export { QUIZ_OPTIONS } from '@shared/protocol';
export type { QuizOption } from '@shared/protocol';

export const TIMER_PRESETS = [15, 30, 60] as const;
export type TimerPreset = (typeof TIMER_PRESETS)[number];
