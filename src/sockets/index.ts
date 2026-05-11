import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { registerChatNamespace } from './chat.namespace';

export function attachSockets(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });

  registerChatNamespace(io);

  return io;
}
