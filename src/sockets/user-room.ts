import type { Server } from 'socket.io';

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function emitToUser(io: Server, userId: string, event: string, payload: unknown): void {
  io.of('/chat').to(userRoom(userId)).emit(event, payload);
}
