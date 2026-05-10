import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { parseCorsOrigins } from '../config/env';
import { registerChatNamespace } from './chat.namespace';

export function attachSockets(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: parseCorsOrigins(), credentials: true },
  });

  registerChatNamespace(io);

  return io;
}
