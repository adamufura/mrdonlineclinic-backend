import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { verifyAccessToken } from '../services/jwt.service';
import { AuthError } from '../shared/errors';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AuthError('Missing access token'));
  }
  try {
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    req.user = {
      id: new Types.ObjectId(payload.sub),
      role: payload.role,
      adminRole: payload.adminRole,
    };
    return next();
  } catch {
    return next(new AuthError('Invalid or expired access token'));
  }
}
