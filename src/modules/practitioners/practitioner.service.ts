import type { Types } from 'mongoose';
import { ForbiddenError, NotFoundError } from '../../shared/errors';
import { buildMeta, skipForPage } from '../../shared/pagination';
import { uploadBuffer } from '../../services/imagekit.service';
import { AppointmentModel } from '../appointments/appointment.model';
import { ReviewModel } from '../reviews/review.model';
import { listPublicOpenSlots } from '../slots/slot.service';
import { PatientModel, PractitionerModel } from '../users/user.model';
import { auditLog } from '../audit/audit.service';

export async function getMe(userId: Types.ObjectId) {
  const p = await PractitionerModel.findById(userId).populate('specialties').lean();
  if (!p) throw new NotFoundError('Practitioner not found');
  return p;
}

export async function updateMyProfile(userId: Types.ObjectId, body: Record<string, unknown>) {
  const p = await PractitionerModel.findById(userId);
  if (!p) throw new NotFoundError('Practitioner not found');
  if (body.bio !== undefined) p.bio = body.bio as string;
  if (body.yearsOfExperience !== undefined) p.yearsOfExperience = body.yearsOfExperience as number;
  if (body.qualifications !== undefined) p.set('qualifications', body.qualifications);
  if (body.specialties !== undefined) p.set('specialties', body.specialties);
  if (body.consultationLanguages !== undefined) p.set('consultationLanguages', body.consultationLanguages);
  await p.save();
  return p.toObject();
}

export async function uploadCredentials(userId: Types.ObjectId, file: Express.Multer.File) {
  const p = await PractitionerModel.findById(userId);
  if (!p) throw new NotFoundError('Practitioner not found');
  const uploaded = await uploadBuffer({
    buffer: file.buffer,
    fileName: file.originalname || 'license.pdf',
    folder: '/practitioners/credentials',
  });
  p.licenseDocumentUrl = uploaded.url;
  p.verificationStatus = 'PENDING_REVIEW';
  await p.save();
  return { licenseDocumentUrl: uploaded.url, verificationStatus: p.verificationStatus };
}

export async function uploadPhoto(userId: Types.ObjectId, file: Express.Multer.File) {
  const p = await PractitionerModel.findById(userId);
  if (!p) throw new NotFoundError('Practitioner not found');
  const uploaded = await uploadBuffer({
    buffer: file.buffer,
    fileName: file.originalname || 'profile.jpg',
    folder: '/practitioners/profile',
  });
  p.profilePhotoUrl = uploaded.url;
  await p.save();
  return { profilePhotoUrl: uploaded.url };
}

export async function listDirectory(query: {
  page: number;
  limit: number;
  specialtyId?: string;
  search?: string;
  sort?: 'rating' | 'experience' | 'createdAt';
}) {
  const filter: Record<string, unknown> = {
    role: 'PRACTITIONER',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
  };
  if (query.specialtyId) filter.specialties = query.specialtyId;
  if (query.search) {
    filter.$or = [
      { firstName: new RegExp(query.search, 'i') },
      { lastName: new RegExp(query.search, 'i') },
    ];
  }
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
      'firstName lastName bio yearsOfExperience averageRating totalReviews profilePhotoUrl specialties consultationLanguages',
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
    status: { $in: ['COMPLETED', 'CONFIRMED', 'IN_PROGRESS'] },
  });
  return PatientModel.find({ _id: { $in: patientIds } })
    .select('firstName lastName email phoneNumber')
    .lean();
}

export async function listAllPractitionersAdmin(page: number, limit: number) {
  const filter = { role: 'PRACTITIONER' };
  const total = await PractitionerModel.countDocuments(filter);
  const rows = await PractitionerModel.find(filter)
    .sort({ createdAt: -1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
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
  const p = await PractitionerModel.findById(id).lean();
  if (!p) throw new NotFoundError('Practitioner not found');
  return p;
}
