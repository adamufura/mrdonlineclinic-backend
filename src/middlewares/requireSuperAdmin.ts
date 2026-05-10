import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../shared/errors';

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN' || req.user.adminRole !== 'SUPER_ADMIN') {
    return next(new ForbiddenError('Super admin only'));
  }
  return next();
}
