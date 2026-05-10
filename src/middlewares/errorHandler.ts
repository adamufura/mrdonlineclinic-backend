import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors';
import { fail } from '../shared/envelope';
import { logger } from '../config/logger';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json(fail('Validation failed', err.flatten()));
  }

  if (err instanceof AppError) {
    if (!err.isOperational || err.statusCode >= 500) {
      logger.error({ err }, err.message);
    }
    return res.status(err.statusCode).json(fail(err.message));
  }

  logger.error({ err }, 'Unhandled error');
  return res.status(500).json(fail('Internal server error'));
}
