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
