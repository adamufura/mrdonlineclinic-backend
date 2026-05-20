import type { NextFunction, Request, Response } from 'express';
import type { AdminPermission } from '../config/admin-rbac';
import { roleHasPermission } from '../config/admin-rbac';
import { ForbiddenError } from '../shared/errors';

export function requirePermission(...permissions: AdminPermission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return next(new ForbiddenError());
    }
    const ok = permissions.some((p) => roleHasPermission(req.user!.adminRole, p));
    if (!ok) return next(new ForbiddenError('Insufficient permissions'));
    return next();
  };
}
