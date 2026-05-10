import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../shared/errors';
import type { AuthRole } from '../types/express';

export function requireRole(...allowed: AuthRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ForbiddenError());
    if (!allowed.includes(req.user.role)) return next(new ForbiddenError());
    return next();
  };
}
