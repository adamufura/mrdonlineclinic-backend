import type { Server } from 'socket.io';
import { Types } from 'mongoose';
import { verifyAccessToken } from '../services/jwt.service';
import { logger } from '../config/logger';
import * as chatService from '../modules/chat/chat.service';
import { MessageModel } from '../modules/chat/message.model';
import { userRoom } from './user-room';

const lastSend = new Map<string, number>();

export function registerChatNamespace(io: Server) {
  const nsp = io.of('/chat');

  nsp.use((socket, next) => {
    try {
      const raw =
        (socket.handshake.auth as { token?: string })?.token ||
        (typeof socket.handshake.headers.authorization === 'string'
          ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : '');
      if (!raw) return next(new Error('Unauthorized'));
      const payload = verifyAccessToken(raw);
      socket.data.userId = payload.sub;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  nsp.on('connection', (socket) => {
    const userId = new Types.ObjectId(String(socket.data.userId));
    void socket.join(userRoom(String(userId)));

    socket.on('joinRoom', async (roomId: string, cb?: (err?: Error) => void) => {
      try {
        await chatService.listMessages(roomId, userId, 1, 1);
        await socket.join(roomId);
        cb?.();
      } catch (e) {
        cb?.(e as Error);
      }
    });

    socket.on('leaveRoom', (roomId: string) => {
      void socket.leave(roomId);
    });

    socket.on('sendMessage', async (payload: { roomId: string; content: string; messageType?: string; attachments?: { url: string; type?: string; fileName?: string; size?: number; mimeType?: string; duration?: number }[] }, cb?: (err?: Error, msg?: unknown) => void) => {
      try {
        const now = Date.now();
        const prev = lastSend.get(String(userId)) ?? 0;
        if (now - prev < 400) {
          cb?.(new Error('Rate limited'));
          return;
        }
        lastSend.set(String(userId), now);
        const msg = await chatService.createSocketMessage(
          payload.roomId,
          userId,
          payload.content,
          payload.messageType ?? 'TEXT',
          payload.attachments,
        );
        nsp.to(payload.roomId).emit('message', msg);
        cb?.(undefined, msg);
      } catch (e) {
        cb?.(e as Error);
      }
    });

    socket.on('typing', (roomId: string) => {
      socket.to(roomId).emit('typing', { roomId, userId: String(userId) });
    });

    socket.on('stopTyping', (roomId: string) => {
      socket.to(roomId).emit('stopTyping', { roomId, userId: String(userId) });
    });

    socket.on('messageRead', async (payload: { roomId: string; messageId: string }) => {
      try {
        await chatService.markRead(payload.roomId, payload.messageId, userId);
        nsp.to(payload.roomId).emit('messageRead', { messageId: payload.messageId, userId: String(userId) });
      } catch (err) {
        logger.warn({ err }, 'messageRead failed');
      }
    });

    socket.on('messageDelivered', async (payload: { roomId: string; messageId: string }) => {
      try {
        await MessageModel.updateOne(
          { _id: payload.messageId, chatRoom: payload.roomId },
          { $push: { deliveredTo: { user: userId, deliveredAt: new Date() } } },
        );
        nsp.to(payload.roomId).emit('messageDelivered', { messageId: payload.messageId, userId: String(userId) });
      } catch (err) {
        logger.warn({ err }, 'messageDelivered failed');
      }
    });
  });
}
