import type { Request, Response } from 'express';
import { AuthError } from '../../shared/errors';
import { ok } from '../../shared/envelope';
import * as svc from './specialty.service';

export async function listPublic(_req: Request, res: Response) {
  const data = await svc.listPublicSpecialties();
  return res.json(ok('Specialties', data));
}

export async function listAdmin(req: Request, res: Response) {
  const { page, limit, activeOnly } = req.query as unknown as {
    page: number;
    limit: number;
    activeOnly?: boolean;
  };
  const result = await svc.listAdminSpecialties(page, limit, activeOnly);
  return res.json(ok('Specialties', result.items, result.meta));
}

export async function create(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const doc = await svc.createSpecialty(req.body, req.user.id);
  return res.status(201).json(ok('Specialty created', doc));
}

export async function update(req: Request, res: Response) {
  const doc = await svc.updateSpecialty(req.params.id, req.body);
  return res.json(ok('Specialty updated', doc));
}

export async function remove(req: Request, res: Response) {
  const result = await svc.softDeleteOrDeactivateSpecialty(req.params.id);
  return res.json(ok(result.action === 'deleted' ? 'Specialty deleted' : 'Specialty deactivated', result));
}
