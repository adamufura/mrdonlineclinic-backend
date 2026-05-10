import type { Request, Response } from 'express';
import { AuthError } from '../../shared/errors';
import { ok } from '../../shared/envelope';
import * as svc from './admin.service';

export async function invite(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.inviteAdmin(req.user.id, req.body.email, req);
  return res.status(201).json(ok(data.message, data));
}

export async function list(req: Request, res: Response) {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await svc.listAdmins(page, limit);
  return res.json(ok('Admins', result.items, result.meta));
}

export async function deactivate(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.deactivateAdmin(req.user.id, req.params.id, req);
  return res.json(ok(data.message, data));
}

export async function remove(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.removeAdmin(req.user.id, req.params.id, req);
  return res.json(ok(data.message, data));
}

export async function changeRole(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.changeAdminRole(req.user.id, req.params.id, req.body.adminRole, req);
  return res.json(ok('Role updated', data));
}

export async function stats(_req: Request, res: Response) {
  const data = await svc.platformStats();
  return res.json(ok('Stats', data));
}

export async function auditLogs(req: Request, res: Response) {
  const { page, limit, action } = req.query as unknown as { page: number; limit: number; action?: string };
  const result = await svc.listAuditLogs(page, limit, action);
  return res.json(ok('Audit logs', result.items, result.meta));
}
