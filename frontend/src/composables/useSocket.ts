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
