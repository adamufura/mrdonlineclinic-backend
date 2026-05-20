import type { NextFunction, Request, Response } from 'express';
import { roleHasPermission } from '../config/admin-rbac';
import { ForbiddenError } from '../shared/errors';

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN' || !roleHasPermission(req.user.adminRole, 'admins:write')) {
    return next(new ForbiddenError('Super admin only'));
  }
  return next();
}
