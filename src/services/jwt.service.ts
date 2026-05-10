import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env';
import type { AuthRole, AdminRole } from '../types/express';

export type AccessTokenPayload = {
  sub: string;
  role: AuthRole;
  adminRole?: AdminRole;
  typ: 'access';
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
  typ: 'refresh';
};

export function signAccessToken(payload: Omit<AccessTokenPayload, 'typ'>): string {
  const env = getEnv();
  const body: AccessTokenPayload = { ...payload, typ: 'access' };
  return jwt.sign(body, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
  });
}

export function signRefreshToken(userId: string, jti: string): string {
  const env = getEnv();
  const body: RefreshTokenPayload = { sub: userId, jti, typ: 'refresh' };
  return jwt.sign(body, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const env = getEnv();
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload & AccessTokenPayload;
  if (decoded.typ !== 'access') throw new Error('Invalid token type');
  return decoded as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const env = getEnv();
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload & RefreshTokenPayload;
  if (decoded.typ !== 'refresh') throw new Error('Invalid token type');
  return decoded as RefreshTokenPayload;
}
