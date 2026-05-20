import type { Request, Response } from 'express';
import { clearRefreshTokenCookie, setRefreshTokenCookie, getRefreshTokenFromRequest } from '../../config/refreshCookie';
import { AuthError } from '../../shared/errors';
import { ok } from '../../shared/envelope';
import * as authService from './auth.service';

export async function registerPatient(req: Request, res: Response) {
  const result = await authService.registerPatient(req.body);
  return res.status(201).json(ok(result.message, result));
}

export async function registerPractitioner(req: Request, res: Response) {
  const result = await authService.registerPractitioner(req.body);
  return res.status(201).json(ok(result.message, result));
}

export async function login(req: Request, res: Response) {
  const result = await authService.loginPatientPractitioner(req.body, req);
  setRefreshTokenCookie(res, result.tokens.refreshToken);
  return res.json(ok('Login successful', result));
}

export async function adminLogin(req: Request, res: Response) {
  const result = await authService.loginAdmin(req.body, req);
  return res.json(ok('Login successful', result));
}

export async function refresh(req: Request, res: Response) {
  const refreshToken = req.body?.refreshToken ?? getRefreshTokenFromRequest(req);
  if (!refreshToken) throw new AuthError('Missing refresh token');
  const tokens = await authService.refreshTokens({ refreshToken }, req);
  setRefreshTokenCookie(res, tokens.refreshToken);
  return res.json(ok('Token refreshed', { tokens }));
}

export async function logout(req: Request, res: Response) {
  const refreshToken = req.body?.refreshToken ?? getRefreshTokenFromRequest(req);
  if (refreshToken) {
    await authService.logout({ refreshToken });
  }
  clearRefreshTokenCookie(res);
  return res.json(ok('Logged out'));
}

export async function verifyEmail(req: Request, res: Response) {
  const result = await authService.verifyEmail(req.body.token);
  return res.json(ok(result.message, result));
}

export async function forgotPassword(req: Request, res: Response) {
  const result = await authService.forgotPassword(req.body.email);
  return res.json(ok(result.message, result));
}

export async function resetPassword(req: Request, res: Response) {
  const result = await authService.resetPassword(req.body.token, req.body.password);
  return res.json(ok(result.message, result));
}

export async function changePassword(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const result = await authService.changePassword(
    req.user.id,
    req.body.currentPassword,
    req.body.newPassword,
    req,
  );
  setRefreshTokenCookie(res, result.tokens.refreshToken);
  return res.json(ok(result.message, { tokens: result.tokens }));
}

export async function me(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const user = await authService.getMe(req.user.id);
  return res.json(ok('Profile', user));
}

export async function updateLanguage(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const user = await authService.updatePreferredLanguage(
    req.user.id,
    req.body.preferredLanguage,
  );
  return res.json(ok('Language updated', user));
}

export async function acceptAdminInvite(req: Request, res: Response) {
  const result = await authService.acceptAdminInvite(req.body);
  return res.json(ok(result.message, result));
}
