import type { Request, Response } from 'express';
import { AuthError } from '../../shared/errors';
import { ok } from '../../shared/envelope';
import * as svc from './prescription.service';

export async function issue(req: Request, res: Response) {
  if (!req.user || req.user.role !== 'PRACTITIONER') throw new AuthError();
  const data = await svc.issuePrescription(req.user.id, req.body);
  return res.status(201).json(ok('Prescription issued', data));
}

export async function listMinePatient(req: Request, res: Response) {
  if (!req.user || req.user.role !== 'PATIENT') throw new AuthError();
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await svc.listForPatient(req.user.id, page, limit);
  return res.json(ok('Prescriptions', result.items, result.meta));
}

export async function getById(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.getByIdForUser(req.params.id, req.user.id, req.user.role);
  return res.json(ok('Prescription', data));
}
