import type { CookieOptions, Request, Response } from 'express';
import { getEnv } from './env';

export const REFRESH_TOKEN_COOKIE = 'mrd_refresh';

export function getRefreshTokenFromRequest(req: Request): string | undefined {
  const fromCookie = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;
  return undefined;
}

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  const env = getEnv();
  const maxAgeMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  const opts: CookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, opts);
}

export function clearRefreshTokenCookie(res: Response): void {
  const env = getEnv();
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
