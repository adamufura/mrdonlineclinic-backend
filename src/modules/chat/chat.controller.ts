import type { Request, Response } from 'express';
import type { Server } from 'socket.io';
import { AuthError } from '../../shared/errors';
import { ok } from '../../shared/envelope';
import * as svc from './chat.service';

export async function listRooms(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await svc.listRoomsForUser(req.user.id, page, limit);
  return res.json(ok('Chat rooms', result.items, result.meta));
}

export async function getRoom(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.getRoomForUser(req.params.roomId, req.user.id);
  return res.json(ok('Chat room', data));
}

export async function markRoomReadAll(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.markRoomReadAll(req.params.roomId, req.user.id);
  return res.json(ok('Marked read', data));
}

export async function listMessages(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { page, limit, before } = req.query as unknown as { page: number; limit: number; before?: Date };
  const result = await svc.listMessages(req.params.roomId, req.user.id, page, limit, before);
  return res.json(ok('Messages', result.items, result.meta));
}

export async function postMessage(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.createHttpMessage(req.params.roomId, req.user.id, req.body);
  const io = req.app.locals.io as Server | undefined;
  io?.of('/chat').to(req.params.roomId).emit('message', data);
  return res.status(201).json(ok('Message sent', data));
}

export async function markRead(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.markRead(req.params.roomId, req.params.messageId, req.user.id);
  return res.json(ok(data.message, data));
}
