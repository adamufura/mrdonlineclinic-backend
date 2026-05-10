import type { Request, Response } from 'express';
import { AuthError } from '../../shared/errors';
import { ok } from '../../shared/envelope';
import * as svc from './chat.service';

export async function listMessages(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { page, limit, before } = req.query as unknown as { page: number; limit: number; before?: Date };
  const result = await svc.listMessages(req.params.roomId, req.user.id, page, limit, before);
  return res.json(ok('Messages', result.items, result.meta));
}

export async function postMessage(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.createHttpMessage(req.params.roomId, req.user.id, req.body);
  return res.status(201).json(ok('Message sent', data));
}

export async function markRead(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.markRead(req.params.roomId, req.params.messageId, req.user.id);
  return res.json(ok(data.message, data));
}
