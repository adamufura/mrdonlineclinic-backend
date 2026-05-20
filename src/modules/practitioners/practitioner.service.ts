import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import type { Types } from 'mongoose';
import { DEFAULT_STAFF_PASSWORD } from '../../config/admin-rbac';
import { hashPassword } from '../../services/password.service';
import { SpecialtyModel } from '../specialties/specialty.model';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { buildMeta, skipForPage } from '../../shared/pagination';
import {
  deleteFileById,
  practitionerCredentialsFolder,
  practitionerSignatureFolder,
  uploadBuffer,
  uploadProfilePhoto,
} from '../../services/imagekit.service';
import { AppointmentModel } from '../appointments/appointment.model';
import { ReviewModel } from '../reviews/review.model';
import { SlotModel } from '../slots/slot.model';
import { listPublicOpenSlots } from '../slots/slot.service';
import { PatientModel, PractitionerModel } from '../users/user.model';
import { auditLog } from '../audit/audit.service';

dayjs.extend(utc);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getMe(userId: Types.ObjectId) {
  const p = await PractitionerModel.findById(userId).populate('specialties').lean();
  if (!p) throw new NotFoundError('Practitioner not found');
  return p;
}

export async function updateMyProfile(userId: Types.ObjectId, body: Record<string, unknown>) {
  const p = await PractitionerModel.findById(userId);
  if (!p) throw new NotFoundError('Practitioner not found');
  if (body.firstName !== undefined) p.firstName = body.firstName as string;
  if (body.middleName !== undefined) p.middleName = body.middleName as string;
  if (body.lastName !== undefined) p.lastName = body.lastName as string;
  if (body.phoneNumber !== undefined) p.phoneNumber = body.phoneNumber as string;
  if (body.licenseNumber !== undefined) p.licenseNumber = body.licenseNumber as string;
  if (body.bio !== undefined) p.bio = body.bio as string;
  if (body.yearsOfExperience !== undefined) p.yearsOfExperience = body.yearsOfExperience as number;
  if (body.qualifications !== undefined) p.set('qualifications', body.qualifications);
  if (body.specialties !== undefined) p.set('specialties', body.specialties);
  if (body.consultationLanguages !== undefined) p.set('consultationLanguages', body.consultationLanguages);
  if (body.practiceLocation !== undefined) {
    const next = body.practiceLocation as { city?: string; state?: string; country?: string };
    const prev =
      (p.get('practiceLocation') as { city?: string; state?: string; country?: string } | undefined) || {};
    p.set('practiceLocation', { ...prev, ...next });
  }
  await p.save();
  return p.toObject();
}

export async function uploadCredentials(userId: Types.ObjectId, file: Express.Multer.File) {
  const p = await PractitionerModel.findById(userId);
  if (!p) throw new NotFoundError('Practitioner not found');
  const uploaded = await uploadBuffer({
    buffer: file.buffer,
    fileName: file.originalname || 'license.pdf',
    folder: practitionerCredentialsFolder(String(userId)),
  });
  p.licenseDocumentUrl = uploaded.url;
  p.verificationStatus = 'PENDING_REVIEW';
  await p.save();
  return { licenseDocumentUrl: uploaded.url, verificationStatus: p.verificationStatus };
}

export async function uploadPhoto(userId: Types.ObjectId, file: Express.Multer.File) {
  const p = await PractitionerModel.findById(userId).select('+profilePhotoFileId');
  if (!p) throw new NotFoundError('Practitioner not found');
  const uploaded = await uploadProfilePhoto({
    role: 'practitioners',
    userId: String(userId),
    buffer: file.buffer,
    fileName: file.originalname || 'profile.jpg',
    mimeType: file.mimetype,
    previousFileId: p.profilePhotoFileId,
  });
  p.profilePhotoUrl = uploaded.url;
  p.set('profilePhotoFileId', uploaded.fileId);
  await p.save();
  return { profilePhotoUrl: uploaded.url };
}

export async function uploadSignature(userId: Types.ObjectId, file: Express.Multer.File) {
  const p = await PractitionerModel.findById(userId).select('+signatureFileId');
  if (!p) throw new NotFoundError('Practitioner not found');
  await deleteFileById(p.signatureFileId);
  const uploaded = await uploadBuffer({
    buffer: file.buffer,
    fileName: file.originalname || 'signature.png',
    folder: practitionerSignatureFolder(String(userId)),
    mimeType: file.mimetype,
    useUniqueFileName: true,
  });
  p.signatureUrl = uploaded.url;
  p.set('signatureFileId', uploaded.fileId);
  await p.save();
  return { signatureUrl: uploaded.url };
}

export async function listDirectory(query: {
  page: number;
  limit: number;
  specialtyId?: string;
  search?: string;
  location?: string;
  date?: string;
  sort?: 'rating' | 'experience' | 'createdAt';
}) {
  const base: Record<string, unknown> = {
    role: 'PRACTITIONER',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
  };
  const and: Record<string, unknown>[] = [base];

  if (query.specialtyId) {
    and.push({ specialties: query.specialtyId });
  }
  if (query.search?.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), 'i');
    and.push({ $or: [{ firstName: rx }, { lastName: rx }, { bio: rx }] });
  }
  if (query.location?.trim()) {
    const rx = new RegExp(escapeRegex(query.location.trim()), 'i');
    and.push({
      $or: [
        { 'practiceLocation.city': rx },
        { 'practiceLocation.state': rx },
        { 'practiceLocation.country': rx },
      ],
    });
  }
  if (query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
    const start = dayjs.utc(query.date).startOf('day').toDate();
    const end = dayjs.utc(query.date).endOf('day').toDate();
    const practitionerIds = await SlotModel.distinct('practitioner', {
      status: 'OPEN',
      startTime: { $gte: start, $lte: end },
    });
    and.push({ _id: { $in: practitionerIds } });
  }

  const filter: Record<string, unknown> = and.length === 1 ? and[0]! : { $and: and };

  const sort: Record<string, 1 | -1> =
    query.sort === 'experience'
      ? { yearsOfExperience: -1 }
      : query.sort === 'createdAt'
        ? { createdAt: -1 }
        : { averageRating: -1 };

  const total = await PractitionerModel.countDocuments(filter);
  const rows = await PractitionerModel.find(filter)
    .sort(sort)
    .skip(skipForPage(query.page, query.limit))
    .limit(query.limit)
    .populate('specialties', 'name slug')
    .select(
      'firstName lastName bio yearsOfExperience averageRating totalReviews profilePhotoUrl specialties consultationLanguages practiceLocation',
    )
    .lean();
  return { items: rows, meta: buildMeta(total, query.page, query.limit) };
}

export async function getPublicProfile(practitionerId: string) {
  const p = await PractitionerModel.findOne({
    _id: practitionerId,
    role: 'PRACTITIONER',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
  })
    .populate('specialties')
    .lean();
  if (!p) throw new NotFoundError('Practitioner not found');
  const reviews = await ReviewModel.find({ practitioner: practitionerId, isVisible: true })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('patient', 'firstName lastName')
    .lean();
  return { practitioner: p, reviews };
}

export async function getPublicSlots(practitionerId: string, from: Date, to: Date) {
  return listPublicOpenSlots(practitionerId, from, to);
}

export async function listConsultedPatients(userId: Types.ObjectId) {
  const patientIds = await AppointmentModel.distinct('patient', {
    practitioner: userId,
    status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
  });
  if (patientIds.length === 0) return [];

  const patients = await PatientModel.find({ _id: { $in: patientIds } })
    .select('firstName lastName email phoneNumber')
    .lean();

  const lastVisits = await AppointmentModel.aggregate<{ _id: Types.ObjectId; lastAt: Date }>([
    { $match: { practitioner: userId, patient: { $in: patientIds } } },
    { $group: { _id: '$patient', lastAt: { $max: '$scheduledStart' } } },
  ]);
  const lastMap = new Map(lastVisits.map((r) => [String(r._id), r.lastAt]));

  const merged = patients.map((p) => ({
    ...p,
    lastAppointmentAt: lastMap.get(String(p._id)) ?? null,
  }));

  merged.sort((a, b) => {
    const ta = a.lastAppointmentAt ? new Date(a.lastAppointmentAt).getTime() : 0;
    const tb = b.lastAppointmentAt ? new Date(b.lastAppointmentAt).getTime() : 0;
    return tb - ta;
  });

  return merged;
}

export async function listAllPractitionersAdmin(
  page: number,
  limit: number,
  opts?: { search?: string; status?: string; verificationStatus?: string },
) {
  const filter: Record<string, unknown> = { role: 'PRACTITIONER' };
  if (opts?.status) filter.status = opts.status;
  if (opts?.verificationStatus) filter.verificationStatus = opts.verificationStatus;
  if (opts?.search?.trim()) {
    filter.$or = [
      { firstName: new RegExp(escapeRegex(opts.search.trim()), 'i') },
      { lastName: new RegExp(escapeRegex(opts.search.trim()), 'i') },
      { email: new RegExp(escapeRegex(opts.search.trim()), 'i') },
      { phoneNumber: new RegExp(escapeRegex(opts.search.trim()), 'i') },
      { licenseNumber: new RegExp(escapeRegex(opts.search.trim()), 'i') },
    ];
  }
  const total = await PractitionerModel.countDocuments(filter);
  const rows = await PractitionerModel.find(filter)
    .sort({ createdAt: -1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .populate('specialties', 'name slug')
    .populate('verifiedBy', 'firstName lastName email')
    .lean();
  return { items: rows, meta: buildMeta(total, page, limit) };
}

export async function verifyPractitioner(
  adminId: Types.ObjectId,
  practitionerId: string,
  notes: string | undefined,
  req: import('express').Request,
) {
  const p = await PractitionerModel.findById(practitionerId);
  if (!p) throw new NotFoundError('Practitioner not found');
  p.verificationStatus = 'VERIFIED';
  p.verificationNotes = notes;
  p.verifiedAt = new Date();
  p.verifiedBy = adminId;
  p.isAvailableForBooking = true;
  await p.save();
  await auditLog({
    actor: adminId,
    actorRole: 'ADMIN',
    action: 'PRACTITIONER_VERIFIED',
    targetType: 'User',
    targetId: practitionerId,
    metadata: { notes },
    req,
  });
  return p.toObject();
}

export async function rejectPractitioner(
  adminId: Types.ObjectId,
  practitionerId: string,
  notes: string,
  req: import('express').Request,
) {
  const p = await PractitionerModel.findById(practitionerId);
  if (!p) throw new NotFoundError('Practitioner not found');
  p.verificationStatus = 'REJECTED';
  p.verificationNotes = notes;
  p.isAvailableForBooking = false;
  await p.save();
  await auditLog({
    actor: adminId,
    actorRole: 'ADMIN',
    action: 'PRACTITIONER_REJECTED',
    targetType: 'User',
    targetId: practitionerId,
    metadata: { notes },
    req,
  });
  return p.toObject();
}

export async function suspendPractitioner(adminId: Types.ObjectId, practitionerId: string, req: import('express').Request) {
  const p = await PractitionerModel.findById(practitionerId);
  if (!p) throw new NotFoundError('Practitioner not found');
  p.status = 'SUSPENDED';
  p.isAvailableForBooking = false;
  await p.save();
  await auditLog({
    actor: adminId,
    actorRole: 'ADMIN',
    action: 'PRACTITIONER_SUSPENDED',
    targetType: 'User',
    targetId: practitionerId,
    req,
  });
  return p.toObject();
}

export async function getPractitionerAdmin(actorRole: string, id: string) {
  if (actorRole !== 'ADMIN') throw new ForbiddenError();
  const p = await PractitionerModel.findById(id)
    .populate('specialties', 'name slug')
    .populate('verifiedBy', 'firstName lastName email')
    .lean();
  if (!p) throw new NotFoundError('Practitioner not found');

  const [appointments, appointmentStats, reviewsCount] = await Promise.all([
    AppointmentModel.find({ practitioner: id })
      .sort({ scheduledStart: -1 })
      .limit(15)
      .populate('patient', 'firstName lastName email phoneNumber')
      .lean(),
    AppointmentModel.aggregate<{ _id: string; count: number }>([
      { $match: { practitioner: p._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    ReviewModel.countDocuments({ practitioner: id }),
  ]);

  return {
    practitioner: p,
    appointments,
    appointmentStats: Object.fromEntries(appointmentStats.map((r) => [r._id, r.count])),
    reviewsCount,
  };
}

export async function deletePractitionerAdmin(
  actorId: Types.ObjectId,
  practitionerId: string,
  req: import('express').Request,
) {
  const p = await PractitionerModel.findById(practitionerId);
  if (!p) throw new NotFoundError('Practitioner not found');
  await p.deleteOne();
  await auditLog({
    actor: actorId,
    actorRole: 'ADMIN',
    action: 'PRACTITIONER_REMOVED',
    targetType: 'User',
    targetId: practitionerId,
    req,
  });
  return { message: 'Practitioner removed' };
}

export async function createPractitionerByAdmin(
  adminId: Types.ObjectId,
  body: {
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
    phoneNumber: string;
    specialties: string[];
    licenseNumber?: string;
    bio?: string;
    yearsOfExperience?: number;
    autoVerify?: boolean;
  },
  req: import('express').Request,
) {
  const email = body.email.toLowerCase();
  const exists = await PractitionerModel.exists({ $or: [{ email }, { phoneNumber: body.phoneNumber }] });
  if (exists) throw new ConflictError('Email or phone number already registered');

  const specialtyIds = [...new Set(body.specialties)];
  const activeCount = await SpecialtyModel.countDocuments({ _id: { $in: specialtyIds }, isActive: true });
  if (activeCount !== specialtyIds.length) {
    throw new ValidationError('One or more specialties are invalid or inactive');
  }

  const passwordHash = await hashPassword(DEFAULT_STAFF_PASSWORD);
  const autoVerify = body.autoVerify !== false;

  const p = await PractitionerModel.create({
    firstName: body.firstName,
    lastName: body.lastName,
    middleName: body.middleName,
    email,
    phoneNumber: body.phoneNumber,
    passwordHash,
    specialties: specialtyIds,
    licenseNumber: body.licenseNumber,
    bio: body.bio,
    yearsOfExperience: body.yearsOfExperience,
    status: 'ACTIVE',
    isEmailVerified: true,
    verificationStatus: autoVerify ? 'VERIFIED' : 'PENDING_REVIEW',
    isAvailableForBooking: autoVerify,
    verifiedAt: autoVerify ? new Date() : undefined,
    verifiedBy: autoVerify ? adminId : undefined,
    onboardedBy: adminId,
    onboardedAt: new Date(),
  });

  await auditLog({
    actor: adminId,
    actorRole: 'ADMIN',
    action: 'PRACTITIONER_ONBOARDED',
    targetType: 'User',
    targetId: String(p._id),
    metadata: { email, autoVerify },
    req,
  });

  const obj = p.toObject();
  return {
    practitioner: obj,
    defaultPassword: DEFAULT_STAFF_PASSWORD,
    message: `Practitioner onboarded. Default password: ${DEFAULT_STAFF_PASSWORD}`,
  };
}

export async function updatePractitionerByAdmin(practitionerId: string, body: Record<string, unknown>) {
  const p = await PractitionerModel.findById(practitionerId);
  if (!p) throw new NotFoundError('Practitioner not found');
  if (body.firstName !== undefined) p.firstName = body.firstName as string;
  if (body.middleName !== undefined) p.middleName = body.middleName as string;
  if (body.lastName !== undefined) p.lastName = body.lastName as string;
  if (body.phoneNumber !== undefined) p.phoneNumber = body.phoneNumber as string;
  if (body.licenseNumber !== undefined) p.licenseNumber = body.licenseNumber as string;
  if (body.bio !== undefined) p.bio = body.bio as string;
  if (body.yearsOfExperience !== undefined) p.yearsOfExperience = body.yearsOfExperience as number;
  if (body.specialties !== undefined) p.set('specialties', body.specialties);
  if (body.isAvailableForBooking !== undefined) p.isAvailableForBooking = Boolean(body.isAvailableForBooking);
  await p.save();
  return p.toObject();
}

export async function uploadCredentialsForPractitioner(
  adminId: Types.ObjectId,
  practitionerId: string,
  file: Express.Multer.File,
  req: import('express').Request,
) {
  const p = await PractitionerModel.findById(practitionerId);
  if (!p) throw new NotFoundError('Practitioner not found');
  const uploaded = await uploadBuffer({
    buffer: file.buffer,
    fileName: file.originalname || 'license.pdf',
    folder: practitionerCredentialsFolder(String(practitionerId)),
  });
  p.licenseDocumentUrl = uploaded.url;
  if (p.verificationStatus === 'UNVERIFIED') p.verificationStatus = 'PENDING_REVIEW';
  await p.save();
  await auditLog({
    actor: adminId,
    actorRole: 'ADMIN',
    action: 'PRACTITIONER_CREDENTIALS_UPLOADED',
    targetType: 'User',
    targetId: practitionerId,
    req,
  });
  return { licenseDocumentUrl: uploaded.url, verificationStatus: p.verificationStatus };
}

export async function resetPractitionerPassword(adminId: Types.ObjectId, practitionerId: string, req: import('express').Request) {
  const p = await PractitionerModel.findById(practitionerId).select('+passwordHash');
  if (!p) throw new NotFoundError('Practitioner not found');
  p.passwordHash = await hashPassword(DEFAULT_STAFF_PASSWORD);
  p.set('refreshTokens', []);
  await p.save();
  await auditLog({
    actor: adminId,
    actorRole: 'ADMIN',
    action: 'PRACTITIONER_PASSWORD_RESET',
    targetType: 'User',
    targetId: practitionerId,
    req,
  });
  return { message: `Password reset to default: ${DEFAULT_STAFF_PASSWORD}`, defaultPassword: DEFAULT_STAFF_PASSWORD };
}
