import type { Types } from 'mongoose';
import {
  canAssignAdminRole,
  DEFAULT_STAFF_PASSWORD,
  getPermissionsForRole,
  normalizeAdminRole,
  type AdminRole,
} from '../../config/admin-rbac';
import { hashPassword } from '../../services/password.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { buildMeta, skipForPage } from '../../shared/pagination';
import { AppointmentModel } from '../appointments/appointment.model';
import { AuditLogModel } from '../audit/audit-log.model';
import { UserModel, AdminModel } from '../users/user.model';
import { auditLog } from '../audit/audit.service';

export async function createAdmin(
  actorId: Types.ObjectId,
  actorRole: string | undefined,
  body: {
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
    phoneNumber: string;
    adminRole: AdminRole;
  },
  req: import('express').Request,
) {
  if (!canAssignAdminRole(actorRole, body.adminRole)) {
    throw new ForbiddenError('You cannot assign this role');
  }

  const normalized = body.email.toLowerCase();
  const exists = await UserModel.exists({ email: normalized });
  if (exists) throw new ConflictError('User with this email already exists');

  const phoneExists = await UserModel.exists({ phoneNumber: body.phoneNumber });
  if (phoneExists) throw new ConflictError('Phone number already in use');

  const passwordHash = await hashPassword(DEFAULT_STAFF_PASSWORD);
  const permissions = getPermissionsForRole(body.adminRole);

  const admin = await AdminModel.create({
    firstName: body.firstName,
    lastName: body.lastName,
    middleName: body.middleName,
    email: normalized,
    phoneNumber: body.phoneNumber,
    passwordHash,
    status: 'ACTIVE',
    adminRole: body.adminRole,
    permissions,
    isEmailVerified: true,
    invitedBy: actorId,
  });

  await auditLog({
    actor: actorId,
    actorRole: normalizeAdminRole(actorRole) ?? 'ADMIN',
    action: 'ADMIN_CREATED',
    targetType: 'User',
    targetId: String(admin._id),
    metadata: { adminRole: body.adminRole, email: normalized },
    req,
  });

  const obj = admin.toObject();
  delete (obj as { passwordHash?: string }).passwordHash;
  return {
    admin: obj,
    defaultPassword: DEFAULT_STAFF_PASSWORD,
    message: `Staff account created. Default password: ${DEFAULT_STAFF_PASSWORD}`,
  };
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

export async function deactivateAdmin(actorId: Types.ObjectId, actorRole: string | undefined, targetId: string, req: import('express').Request) {
  if (String(actorId) === targetId) throw new ForbiddenError('Cannot deactivate yourself');
  const admin = await AdminModel.findById(targetId);
  if (!admin) throw new NotFoundError('Admin not found');
  if (admin.adminRole === 'SUPER_ADMIN') throw new ForbiddenError('Cannot deactivate super admin this way');
  if (!canAssignAdminRole(actorRole, normalizeAdminRole(admin.adminRole) ?? 'OPERATIONS')) {
    throw new ForbiddenError('You cannot deactivate this account');
  }
  admin.status = 'DEACTIVATED';
  await admin.save();
  await auditLog({
    actor: actorId,
    actorRole: normalizeAdminRole(actorRole) ?? 'ADMIN',
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
  actorRole: string | undefined,
  targetId: string,
  adminRole: AdminRole,
  req: import('express').Request,
) {
  if (!canAssignAdminRole(actorRole, adminRole)) {
    throw new ForbiddenError('You cannot assign this role');
  }
  const admin = await AdminModel.findById(targetId);
  if (!admin) throw new NotFoundError('Admin not found');
  if (admin.adminRole === 'SUPER_ADMIN' && adminRole !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Cannot change super admin role');
  }
  admin.adminRole = adminRole;
  admin.set('permissions', getPermissionsForRole(adminRole));
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

export async function resetAdminPassword(actorId: Types.ObjectId, targetId: string, req: import('express').Request) {
  const admin = await AdminModel.findById(targetId).select('+passwordHash');
  if (!admin) throw new NotFoundError('Admin not found');
  if (admin.adminRole === 'SUPER_ADMIN' && String(actorId) !== targetId) {
    throw new ForbiddenError('Cannot reset super admin password');
  }
  admin.passwordHash = await hashPassword(DEFAULT_STAFF_PASSWORD);
  admin.set('refreshTokens', []);
  await admin.save();
  await auditLog({
    actor: actorId,
    actorRole: 'SUPER_ADMIN',
    action: 'ADMIN_PASSWORD_RESET',
    targetType: 'User',
    targetId,
    req,
  });
  return { message: `Password reset to default: ${DEFAULT_STAFF_PASSWORD}`, defaultPassword: DEFAULT_STAFF_PASSWORD };
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
    .populate('actor', 'firstName lastName email role adminRole')
    .lean();
  return { items: rows, meta: buildMeta(total, page, limit) };
}
