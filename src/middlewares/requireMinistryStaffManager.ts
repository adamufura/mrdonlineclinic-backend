import type { NextFunction, Request, Response } from 'express';
import { canAssignAdminRole } from '../config/admin-rbac';
import { ForbiddenError } from '../shared/errors';

/** Allows SUPER_ADMIN and DEPUTY_DIRECTOR to manage ministry staff. */
export function requireMinistryStaffManager(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new ForbiddenError());
  }
  if (!canAssignAdminRole(req.user.adminRole, 'OPERATIONS')) {
    return next(new ForbiddenError('Insufficient permissions'));
  }
  return next();
}
