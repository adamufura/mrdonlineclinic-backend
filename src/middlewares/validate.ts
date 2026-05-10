import type { NextFunction, Request, Response } from 'express';
import type { AnyZodObject, ZodEffects } from 'zod';
import { ZodError } from 'zod';

type Schema = AnyZodObject | ZodEffects<AnyZodObject>;

export function validateBody<T extends Schema>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (e) {
      next(e instanceof ZodError ? e : e);
    }
  };
}

export function validateQuery<T extends Schema>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as Request['query'];
      next();
    } catch (e) {
      next(e instanceof ZodError ? e : e);
    }
  };
}

export function validateParams<T extends Schema>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as Request['params'];
      next();
    } catch (e) {
      next(e instanceof ZodError ? e : e);
    }
  };
}
