import crypto from 'crypto';
import dayjs from 'dayjs';
import type { Request } from 'express';
import type { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { getEnv } from '../../config/env';
import { getEmailAdapter } from '../../services/email';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../services/jwt.service';
import { hashPassword, verifyPassword } from '../../services/password.service';
import { hashToken } from '../../services/token-hash.service';
import { AuthError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import type { AdminRole, AuthRole } from '../../types/express';
import { SpecialtyModel } from '../specialties/specialty.model';
import { AdminModel, PatientModel, PractitionerModel, UserModel } from '../users/user.model';
import type { z } from 'zod';
import type { SafeUser, TokenPair } from './auth.types';
import { registerPractitionerSchema } from './auth.validation';

function randomUrlToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function adminRoleFromDoc(doc: { role?: string; adminRole?: AdminRole }): AdminRole | undefined {
  if (doc.role === 'ADMIN') return doc.adminRole;
  return undefined;
}

function toSafeUser(doc: Record<string, unknown>): SafeUser {
  return {
    id: String(doc._id),
    role: doc.role as AuthRole,
    adminRole: doc.adminRole as AdminRole | undefined,
    firstName: doc.firstName as string,
    middleName: doc.middleName as string | undefined,
    lastName: doc.lastName as string,
    email: doc.email as string,
    phoneNumber: doc.phoneNumber as string,
    status: doc.status as string,
    isEmailVerified: Boolean(doc.isEmailVerified),
    lastLoginAt: doc.lastLoginAt as Date | undefined,
    profilePhotoUrl:
      typeof doc.profilePhotoUrl === 'string' && doc.profilePhotoUrl.trim()
        ? doc.profilePhotoUrl
        : undefined,
  };
}

async function issueTokens(userId: Types.ObjectId, role: AuthRole, adminRole: AdminRole | undefined, req: Request): Promise<TokenPair> {
  const env = getEnv();
  const jti = uuidv4();
  const refreshToken = signRefreshToken(String(userId), jti);
  const tokenHash = hashToken(refreshToken);
  const expiresAt = dayjs().add(env.REFRESH_TOKEN_TTL_DAYS, 'day').toDate();

  await UserModel.findByIdAndUpdate(userId, {
    $push: {
      refreshTokens: {
        $each: [
          {
            tokenHash,
            jti,
            expiresAt,
            userAgent: req.get('user-agent'),
            ip: req.ip,
          },
        ],
        $slice: -20,
      },
    },
  });

  const accessToken = signAccessToken({
    sub: String(userId),
    role,
    adminRole,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
  };
}

export async function registerPatient(body: {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
}) {
  const email = body.email.toLowerCase();
  const exists = await UserModel.exists({ $or: [{ email }, { phoneNumber: body.phoneNumber }] });
  if (exists) throw new ConflictError('Email or phone number already registered');

  const { password, ...profile } = body;
  const passwordHash = await hashPassword(password);

  await PatientModel.create({
    ...profile,
    email,
    passwordHash,
    status: 'ACTIVE',
    isEmailVerified: true,
  });

  return { message: 'Account created successfully. You can log in now.' };
}

type RegisterPractitionerBody = z.infer<typeof registerPractitionerSchema>;

export async function registerPractitioner(body: RegisterPractitionerBody) {
  const email = body.email.toLowerCase();
  const exists = await UserModel.exists({ $or: [{ email }, { phoneNumber: body.phoneNumber }] });
  if (exists) throw new ConflictError('Email or phone number already registered');

  const { password, specialties, ...profile } = body;
  const specialtyIds = [...new Set(specialties)];
  const activeCount = await SpecialtyModel.countDocuments({
    _id: { $in: specialtyIds },
    isActive: true,
  });
  if (activeCount !== specialtyIds.length) {
    throw new ValidationError('One or more specialties are invalid or inactive');
  }

  const passwordHash = await hashPassword(password);

  await PractitionerModel.create({
    ...profile,
    specialties: specialtyIds,
    email,
    passwordHash,
    status: 'ACTIVE',
    isEmailVerified: true,
    verificationStatus: 'UNVERIFIED',
    isAvailableForBooking: false,
  });

  return { message: 'Account created successfully. You can log in now.' };
}

export async function loginPatientPractitioner(body: { email: string; password: string }, req: Request) {
  const email = body.email.toLowerCase();
  const user = await UserModel.findOne({ email }).select('+passwordHash');
  if (!user) throw new AuthError('Invalid credentials');
  const role = (user as unknown as { role: AuthRole }).role;
  if (role === 'ADMIN') throw new ForbiddenError('Use admin login');
  const ok = await verifyPassword(body.password, user.passwordHash);
  if (!ok) throw new AuthError('Invalid credentials');
  if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
    throw new AuthError('Account is not active');
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const tokens = await issueTokens(user._id, role, adminRoleFromDoc(user.toObject() as { role?: string; adminRole?: AdminRole }), req);
  return { user: toSafeUser(user.toObject() as Record<string, unknown>), tokens };
}

export async function loginAdmin(body: { email: string; password: string }, req: Request) {
  const email = body.email.toLowerCase();
  const user = await UserModel.findOne({ email, role: 'ADMIN' }).select('+passwordHash');
  if (!user) throw new AuthError('Invalid credentials');
  const ok = await verifyPassword(body.password, user.passwordHash);
  if (!ok) throw new AuthError('Invalid credentials');
  if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
    throw new AuthError('Account is not active');
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const tokens = await issueTokens(user._id, 'ADMIN', (user as { adminRole?: AdminRole }).adminRole, req);
  return { user: toSafeUser(user.toObject() as Record<string, unknown>), tokens };
}

export async function refreshTokens(body: { refreshToken: string }, req: Request) {
  let payload: ReturnType<typeof verifyRefreshToken>;
  try {
    payload = verifyRefreshToken(body.refreshToken);
  } catch {
    throw new AuthError('Invalid refresh token');
  }

  const tokenHash = hashToken(body.refreshToken);
  const user = await UserModel.findById(payload.sub).select('+refreshTokens');
  if (!user) throw new AuthError('Invalid refresh token');

  const entry = user.refreshTokens.find((t) => t.jti === payload.jti && t.tokenHash === tokenHash && !t.revokedAt);
  if (!entry || dayjs(entry.expiresAt).isBefore(dayjs())) {
    throw new AuthError('Invalid refresh token');
  }

  entry.revokedAt = new Date();
  await user.save({ validateBeforeSave: false });

  return issueTokens(
    user._id,
    (user as unknown as { role: AuthRole }).role,
    adminRoleFromDoc(user.toObject() as { role?: string; adminRole?: AdminRole }),
    req,
  );
}

export async function logout(body: { refreshToken: string }) {
  try {
    const payload = verifyRefreshToken(body.refreshToken);
    const tokenHash = hashToken(body.refreshToken);
    await UserModel.updateOne(
      { _id: payload.sub, 'refreshTokens.jti': payload.jti, 'refreshTokens.tokenHash': tokenHash },
      { $set: { 'refreshTokens.$.revokedAt': new Date() } },
    );
  } catch {
    /* ignore invalid token on logout */
  }
  return { message: 'Logged out' };
}

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);
  const user = await UserModel.findOne({
    emailVerificationToken: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken');

  if (!user) throw new ValidationError('Invalid or expired verification token');

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  if (user.status === 'PENDING_VERIFICATION') user.status = 'ACTIVE';
  await user.save();

  return { message: 'Email verified' };
}

export async function forgotPassword(email: string) {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordResetToken');
  if (user) {
    const raw = randomUrlToken();
    user.passwordResetToken = hashToken(raw);
    user.passwordResetExpires = dayjs().add(1, 'hour').toDate();
    await user.save();
    const env = getEnv();
    const link = `${env.CLIENT_URL}/reset-password?token=${raw}`;
    await getEmailAdapter().sendMail({
      to: user.email,
      subject: 'Password reset',
      html: `<p>Reset password: <a href="${link}">${link}</a></p>`,
      text: `Reset password: ${link}`,
    });
  }
  return { message: 'If an account exists, password reset instructions were sent.' };
}

export async function resetPassword(token: string, password: string) {
  const tokenHash = hashToken(token);
  const user = await UserModel.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordHash +passwordResetToken');

  if (!user) throw new ValidationError('Invalid or expired reset token');

  user.passwordHash = await hashPassword(password);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  return { message: 'Password updated' };
}

export async function changePassword(
  userId: Types.ObjectId,
  currentPassword: string,
  newPassword: string,
  req: Request,
) {
  if (!req.user) throw new AuthError();

  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw new NotFoundError('User not found');

  const currentOk = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentOk) {
    throw new ValidationError('Current password is incorrect');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.set('refreshTokens', []);
  await user.save();

  const tokens = await issueTokens(userId, req.user.role, req.user.adminRole, req);
  return { message: 'Password changed successfully', tokens };
}

export async function getMe(userId: Types.ObjectId) {
  const user = await UserModel.findById(userId).lean();
  if (!user) throw new NotFoundError('User not found');
  return toSafeUser(user as Record<string, unknown>);
}

export async function acceptAdminInvite(body: { token: string; password: string }) {
  const tokenHash = hashToken(body.token);
  const user = await AdminModel.findOne({
    invitationToken: tokenHash,
    invitationExpires: { $gt: new Date() },
  }).select('+passwordHash +invitationToken');

  if (!user) throw new ValidationError('Invalid or expired invitation');

  user.passwordHash = await hashPassword(body.password);
  user.invitationToken = undefined;
  user.invitationExpires = undefined;
  user.status = 'ACTIVE';
  await user.save();

  return { message: 'Invitation accepted. You can log in.' };
}
