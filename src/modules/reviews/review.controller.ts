import type { Request, Response } from 'express';
import { AuthError } from '../../shared/errors';
import { ok } from '../../shared/envelope';
import * as svc from './review.service';

export async function create(req: Request, res: Response) {
  if (!req.user || req.user.role !== 'PATIENT') throw new AuthError();
  const data = await svc.createReview(req.user.id, req.body);
  return res.status(201).json(ok('Review submitted', data));
}

export async function hide(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.setVisibilityAdmin(req.params.id, req.body.isVisible);
  return res.json(ok('Review updated', data));
}
