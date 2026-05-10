import type { Request, Response } from 'express';
import { AuthError, NotFoundError } from '../../shared/errors';
import { ok } from '../../shared/envelope';
import { NotificationModel } from './notification.model';
import { buildMeta, skipForPage } from '../../shared/pagination';

export async function list(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { page, limit, unreadOnly } = req.query as unknown as { page: number; limit: number; unreadOnly?: boolean };
  const q: Record<string, unknown> = { recipient: req.user.id };
  if (unreadOnly) q.isRead = false;
  const total = await NotificationModel.countDocuments(q);
  const rows = await NotificationModel.find(q)
    .sort({ createdAt: -1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .lean();
  return res.json(ok('Notifications', rows, buildMeta(total, page, limit)));
}

export async function markRead(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const n = await NotificationModel.findOne({ _id: req.params.id, recipient: req.user.id });
  if (!n) throw new NotFoundError('Notification not found');
  n.isRead = true;
  await n.save();
  return res.json(ok('Marked read', n.toObject()));
}

export async function markAllRead(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  await NotificationModel.updateMany({ recipient: req.user.id, isRead: false }, { $set: { isRead: true } });
  return res.json(ok('All marked read'));
}
