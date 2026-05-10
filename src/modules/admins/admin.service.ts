import crypto from 'crypto';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import type { Types } from 'mongoose';
import { getEnv } from '../../config/env';
import { getEmailAdapter } from '../../services/email';
import { hashPassword } from '../../services/password.service';
import { hashToken } from '../../services/token-hash.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { buildMeta, skipForPage } from '../../shared/pagination';
import { domainEvents } from '../../events/domain.events';
import { AppointmentModel } from '../appointments/appointment.model';
import { AuditLogModel } from '../audit/audit-log.model';
import { UserModel, AdminModel } from '../users/user.model';
import { auditLog } from '../audit/audit.service';

function randomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function inviteAdmin(actorId: Types.ObjectId, email: string, req: import('express').Request) {
  const normalized = email.toLowerCase();
  const exists = await UserModel.exists({ email: normalized });
  if (exists) throw new ConflictError('User with this email already exists');

  const raw = randomToken();
  const tempPassword = await hashPassword(uuidv4());
  await AdminModel.create({
    firstName: 'Invited',
    lastName: 'Admin',
    email: normalized,
    phoneNumber: `inv-${uuidv4().slice(0, 12)}`,
    passwordHash: tempPassword,
    status: 'PENDING_VERIFICATION',
    adminRole: 'ADMIN',
    invitedBy: actorId,
    invitationToken: hashToken(raw),
    invitationExpires: dayjs().add(7, 'day').toDate(),
    isEmailVerified: false,
  });

  const env = getEnv();
  const link = `${env.CLIENT_URL}/admin/accept-invite?token=${raw}`;
  await getEmailAdapter().sendMail({
    to: normalized,
    subject: 'MRD Online Clinic — Admin invitation',
    html: `<p>You were invited as an admin. <a href="${link}">Accept invitation</a></p>`,
    text: `Accept invitation: ${link}`,
  });

  domainEvents.emitTyped('AdminInvited', { email: normalized, token: raw });

  await auditLog({
    actor: actorId,
    actorRole: 'SUPER_ADMIN',
    action: 'ADMIN_INVITED',
    targetType: 'User',
    targetId: normalized,
    req,
  });

  return { message: 'Invitation sent' };
}

export async function listAdmins(page: number, limit: number) {
  const filter = { role: 'ADMIN' };
  const total = await AdminModel.countDocuments(filter);
  const rows = await AdminModel.find(filter)
    .sort({ createdAt: -1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .select('-passwordHash -refreshTokens -invitationToken')
    .lean();
  return { items: rows, meta: buildMeta(total, page, limit) };
}

export async function deactivateAdmin(actorId: Types.ObjectId, targetId: string, req: import('express').Request) {
  if (String(actorId) === targetId) throw new ForbiddenError('Cannot deactivate yourself');
  const admin = await AdminModel.findById(targetId);
  if (!admin) throw new NotFoundError('Admin not found');
  if (admin.adminRole === 'SUPER_ADMIN') throw new ForbiddenError('Cannot deactivate super admin this way');
  admin.status = 'DEACTIVATED';
  await admin.save();
  await auditLog({
    actor: actorId,
    actorRole: 'SUPER_ADMIN',
    action: 'ADMIN_DEACTIVATED',
    targetType: 'User',
    targetId,
    req,
  });
  return { message: 'Admin deactivated' };
}

export async function removeAdmin(actorId: Types.ObjectId, targetId: string, req: import('express').Request) {
  if (String(actorId) === targetId) throw new ForbiddenError('Cannot remove yourself');
  const admin = await AdminModel.findById(targetId);
  if (!admin) throw new NotFoundError('Admin not found');
  if (admin.adminRole === 'SUPER_ADMIN') throw new ForbiddenError('Cannot remove super admin');
  await admin.deleteOne();
  await auditLog({
    actor: actorId,
    actorRole: 'SUPER_ADMIN',
    action: 'ADMIN_REMOVED',
    targetType: 'User',
    targetId,
    req,
  });
  return { message: 'Admin removed' };
}

export async function changeAdminRole(
  actorId: Types.ObjectId,
  targetId: string,
  adminRole: 'SUPER_ADMIN' | 'ADMIN',
  req: import('express').Request,
) {
  const admin = await AdminModel.findById(targetId);
  if (!admin) throw new NotFoundError('Admin not found');
  admin.adminRole = adminRole;
  await admin.save();
  await auditLog({
    actor: actorId,
    actorRole: 'SUPER_ADMIN',
    action: 'ADMIN_ROLE_CHANGED',
    targetType: 'User',
    targetId,
    metadata: { adminRole },
    req,
  });
  return admin.toObject();
}

export async function platformStats() {
  const [patients, practitioners, admins, appointments] = await Promise.all([
    UserModel.countDocuments({ role: 'PATIENT' }),
    UserModel.countDocuments({ role: 'PRACTITIONER' }),
    UserModel.countDocuments({ role: 'ADMIN' }),
    AppointmentModel.countDocuments({}),
  ]);
  return { patients, practitioners, admins, appointments };
}

export async function listAuditLogs(page: number, limit: number, action?: string) {
  const q: Record<string, unknown> = {};
  if (action) q.action = action;
  const total = await AuditLogModel.countDocuments(q);
  const rows = await AuditLogModel.find(q)
    .sort({ createdAt: -1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .populate('actor', 'firstName lastName email role')
    .lean();
  return { items: rows, meta: buildMeta(total, page, limit) };
}
