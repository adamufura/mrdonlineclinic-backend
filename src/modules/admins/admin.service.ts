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
import { PatientModel, PractitionerModel, UserModel, AdminModel } from '../users/user.model';
import { auditLog } from '../audit/audit.service';
import { buildSearchOr } from '../../shared/search';

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

export async function listAdmins(
  page: number,
  limit: number,
  opts?: { search?: string; status?: string; adminRole?: string },
) {
  const filter: Record<string, unknown> = { role: 'ADMIN' };
  if (opts?.status) filter.status = opts.status;
  if (opts?.adminRole) filter.adminRole = opts.adminRole;
  if (opts?.search?.trim()) {
    filter.$or = buildSearchOr(['firstName', 'lastName', 'email', 'phoneNumber'], opts.search);
  }
  const total = await AdminModel.countDocuments(filter);
  const rows = await AdminModel.find(filter)
    .sort({ createdAt: -1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .select('-passwordHash -refreshTokens -invitationToken')
    .lean();
  return { items: rows, meta: buildMeta(total, page, limit) };
}

export async function getAdminById(id: string) {
  const admin = await AdminModel.findById(id)
    .select('-passwordHash -refreshTokens -invitationToken')
    .lean();
  if (!admin) throw new NotFoundError('Admin not found');
  return admin;
}

export async function updateAdmin(
  actorId: Types.ObjectId,
  actorRole: string | undefined,
  targetId: string,
  body: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    phoneNumber?: string;
    status?: string;
  },
  req: import('express').Request,
) {
  const admin = await AdminModel.findById(targetId);
  if (!admin) throw new NotFoundError('Admin not found');
  if (admin.adminRole === 'SUPER_ADMIN' && String(actorId) !== targetId && body.status) {
    throw new ForbiddenError('Cannot change super admin status');
  }
  if (!canAssignAdminRole(actorRole, normalizeAdminRole(admin.adminRole) ?? 'OPERATIONS') && String(actorId) !== targetId) {
    throw new ForbiddenError('You cannot update this account');
  }
  if (body.phoneNumber && body.phoneNumber !== admin.phoneNumber) {
    const phoneExists = await UserModel.exists({ phoneNumber: body.phoneNumber, _id: { $ne: targetId } });
    if (phoneExists) throw new ConflictError('Phone number already in use');
  }
  if (body.firstName !== undefined) admin.firstName = body.firstName;
  if (body.lastName !== undefined) admin.lastName = body.lastName;
  if (body.middleName !== undefined) admin.middleName = body.middleName;
  if (body.phoneNumber !== undefined) admin.phoneNumber = body.phoneNumber;
  if (body.status !== undefined) {
    admin.status = body.status as typeof admin.status;
  }
  await admin.save();
  await auditLog({
    actor: actorId,
    actorRole: normalizeAdminRole(actorRole) ?? 'ADMIN',
    action: 'ADMIN_UPDATED',
    targetType: 'User',
    targetId,
    metadata: body,
    req,
  });
  const obj = admin.toObject();
  delete (obj as { passwordHash?: string }).passwordHash;
  return obj;
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
  const [
    patients,
    practitioners,
    admins,
    appointments,
    pendingVerification,
    pendingAppointments,
    completedAppointments,
    activePatients,
    activePractitioners,
  ] = await Promise.all([
    UserModel.countDocuments({ role: 'PATIENT' }),
    UserModel.countDocuments({ role: 'PRACTITIONER' }),
    UserModel.countDocuments({ role: 'ADMIN' }),
    AppointmentModel.countDocuments({}),
    PractitionerModel.countDocuments({
      role: 'PRACTITIONER',
      verificationStatus: { $in: ['UNVERIFIED', 'PENDING_REVIEW'] },
    }),
    AppointmentModel.countDocuments({ status: 'PENDING' }),
    AppointmentModel.countDocuments({ status: 'COMPLETED' }),
    UserModel.countDocuments({ role: 'PATIENT', status: 'ACTIVE' }),
    PractitionerModel.countDocuments({ role: 'PRACTITIONER', status: 'ACTIVE', verificationStatus: 'VERIFIED' }),
  ]);

  const recentAudit = await AuditLogModel.find({})
    .sort({ createdAt: -1 })
    .limit(8)
    .populate('actor', 'firstName lastName email adminRole')
    .lean();

  const appointmentsByStatus = await AppointmentModel.aggregate<{ _id: string; count: number }>([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  return {
    patients,
    practitioners,
    admins,
    appointments,
    pendingVerification,
    pendingAppointments,
    completedAppointments,
    activePatients,
    activePractitioners,
    appointmentsByStatus: Object.fromEntries(appointmentsByStatus.map((r) => [r._id, r.count])),
    recentAudit,
  };
}

export async function globalSearch(q: string, limit: number) {
  const term = q.trim();
  if (!term) return { practitioners: [], patients: [], staff: [] };

  const or = buildSearchOr(['firstName', 'lastName', 'email', 'phoneNumber'], term);

  const [practitioners, patients, staff] = await Promise.all([
    PractitionerModel.find({ role: 'PRACTITIONER', $or: or })
      .select('firstName lastName email verificationStatus status')
      .limit(limit)
      .lean(),
    PatientModel.find({ role: 'PATIENT', $or: or })
      .select('firstName lastName email status')
      .limit(limit)
      .lean(),
    AdminModel.find({ role: 'ADMIN', $or: or })
      .select('firstName lastName email adminRole status')
      .limit(limit)
      .lean(),
  ]);

  return { practitioners, patients, staff };
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
