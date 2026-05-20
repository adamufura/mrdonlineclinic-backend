import type { Types } from 'mongoose';
import { DEFAULT_STAFF_PASSWORD } from '../../config/admin-rbac';
import { hashPassword } from '../../services/password.service';
import { auditLog } from '../audit/audit.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { buildMeta, skipForPage } from '../../shared/pagination';
import { uploadProfilePhoto } from '../../services/imagekit.service';
import { AppointmentModel } from '../appointments/appointment.model';
import { PatientModel } from '../users/user.model';
import { PrescriptionModel } from '../prescriptions/prescription.model';

export async function getMyProfile(userId: Types.ObjectId) {
  const patient = await PatientModel.findById(userId).lean();
  if (!patient) throw new NotFoundError('Patient not found');
  return patient;
}

export async function updateMyProfile(userId: Types.ObjectId, body: Record<string, unknown>) {
  const patient = await PatientModel.findById(userId);
  if (!patient) throw new NotFoundError('Patient not found');
  Object.assign(patient, body);
  if (patient.dateOfBirth && patient.address?.city) {
    patient.profileCompletedAt = patient.profileCompletedAt ?? new Date();
  }
  await patient.save();
  return patient.toObject();
}

function applyMedicalPatch(patient: InstanceType<typeof PatientModel>, body: Record<string, unknown>) {
  if (body.allergies !== undefined) patient.set('allergies', body.allergies);
  if (body.chronicConditions !== undefined) patient.set('chronicConditions', body.chronicConditions);
  if (body.currentMedications !== undefined) patient.set('currentMedications', body.currentMedications);
  if (body.emergencyContact !== undefined) {
    if (body.emergencyContact === null) {
      patient.set('emergencyContact', undefined);
    } else {
      patient.set('emergencyContact', body.emergencyContact);
    }
  }
  if (body.address !== undefined) {
    if (body.address === null) {
      patient.set('address', undefined);
    } else {
      patient.set('address', body.address);
    }
  }
}

export async function updateMyMedical(userId: Types.ObjectId, body: Record<string, unknown>) {
  const patient = await PatientModel.findById(userId);
  if (!patient) throw new NotFoundError('Patient not found');
  applyMedicalPatch(patient, body);
  await patient.save();
  return patient.toObject();
}

export async function updateMyHealthRecord(
  userId: Types.ObjectId,
  body: { allergies: string[]; chronicConditions: string[]; currentMedications: string[] },
) {
  return updateMyMedical(userId, {
    allergies: body.allergies,
    chronicConditions: body.chronicConditions,
    currentMedications: body.currentMedications,
  });
}

export async function updateMyEmergencyContact(
  userId: Types.ObjectId,
  body: { emergencyContact: { name: string; relationship: string; phoneNumber: string } | null },
) {
  return updateMyMedical(userId, { emergencyContact: body.emergencyContact });
}

export async function updateMyAddress(
  userId: Types.ObjectId,
  body: {
    address: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    } | null;
  },
) {
  return updateMyMedical(userId, { address: body.address });
}

export async function uploadMyPhoto(userId: Types.ObjectId, file: Express.Multer.File) {
  const patient = await PatientModel.findById(userId).select('+profilePhotoFileId');
  if (!patient) throw new NotFoundError('Patient not found');
  const uploaded = await uploadProfilePhoto({
    role: 'patients',
    userId: String(userId),
    buffer: file.buffer,
    fileName: file.originalname || 'profile.jpg',
    mimeType: file.mimetype,
    previousFileId: patient.profilePhotoFileId,
  });
  patient.profilePhotoUrl = uploaded.url;
  patient.set('profilePhotoFileId', uploaded.fileId);
  await patient.save();
  return { profilePhotoUrl: uploaded.url };
}

export async function listMyAppointments(
  userId: Types.ObjectId,
  page: number,
  limit: number,
  filters: { status?: string; from?: Date; to?: Date },
) {
  const q: Record<string, unknown> = { patient: userId };
  if (filters.status) q.status = filters.status;
  if (filters.from || filters.to) {
    q.scheduledStart = {};
    if (filters.from) (q.scheduledStart as Record<string, Date>).$gte = filters.from;
    if (filters.to) (q.scheduledStart as Record<string, Date>).$lte = filters.to;
  }
  const total = await AppointmentModel.countDocuments(q);
  const rows = await AppointmentModel.find(q)
    .sort({ scheduledStart: -1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .populate('practitioner', 'firstName lastName email profilePhotoUrl')
    .populate('slot')
    .lean();
  return { items: rows, meta: buildMeta(total, page, limit) };
}

export async function listMyPrescriptions(userId: Types.ObjectId, page: number, limit: number) {
  const total = await PrescriptionModel.countDocuments({ patient: userId });
  const rows = await PrescriptionModel.find({ patient: userId })
    .sort({ issuedAt: -1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .populate('practitioner', 'firstName lastName')
    .lean();
  return { items: rows, meta: buildMeta(total, page, limit) };
}

export async function listAllPatientsAdmin(page: number, limit: number, search?: string) {
  const q: Record<string, unknown> = { role: 'PATIENT' };
  if (search) {
    q.$or = [
      { firstName: new RegExp(search, 'i') },
      { lastName: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
    ];
  }
  const total = await PatientModel.countDocuments(q);
  const rows = await PatientModel.find(q)
    .sort({ createdAt: -1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .lean();
  return { items: rows, meta: buildMeta(total, page, limit) };
}

export async function getPatientByIdAdmin(actorRole: string, patientId: string) {
  if (actorRole !== 'ADMIN') throw new ForbiddenError();
  const patient = await PatientModel.findById(patientId).lean();
  if (!patient) throw new NotFoundError('Patient not found');
  return patient;
}

export async function createPatientByAdmin(
  adminId: Types.ObjectId,
  body: {
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
    phoneNumber: string;
    dateOfBirth?: Date;
    gender?: string;
  },
  req: import('express').Request,
) {
  const email = body.email.toLowerCase();
  const exists = await PatientModel.exists({ $or: [{ email }, { phoneNumber: body.phoneNumber }] });
  if (exists) throw new ConflictError('Email or phone number already registered');

  const passwordHash = await hashPassword(DEFAULT_STAFF_PASSWORD);
  const patient = await PatientModel.create({
    firstName: body.firstName,
    lastName: body.lastName,
    middleName: body.middleName,
    email,
    phoneNumber: body.phoneNumber,
    passwordHash,
    dateOfBirth: body.dateOfBirth,
    gender: body.gender,
    status: 'ACTIVE',
    isEmailVerified: true,
  });

  await auditLog({
    actor: adminId,
    actorRole: 'ADMIN',
    action: 'PATIENT_ONBOARDED',
    targetType: 'User',
    targetId: String(patient._id),
    metadata: { email },
    req,
  });

  return {
    patient: patient.toObject(),
    defaultPassword: DEFAULT_STAFF_PASSWORD,
    message: `Patient onboarded. Default password: ${DEFAULT_STAFF_PASSWORD}`,
  };
}

export async function updatePatientByAdmin(patientId: string, body: Record<string, unknown>) {
  const patient = await PatientModel.findById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  if (body.firstName !== undefined) patient.firstName = body.firstName as string;
  if (body.middleName !== undefined) patient.middleName = body.middleName as string;
  if (body.lastName !== undefined) patient.lastName = body.lastName as string;
  if (body.phoneNumber !== undefined) patient.phoneNumber = body.phoneNumber as string;
  if (body.dateOfBirth !== undefined) patient.dateOfBirth = body.dateOfBirth as Date;
  if (body.gender !== undefined) {
    patient.gender = body.gender as 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_SAY';
  }
  if (body.status !== undefined) {
    patient.status = body.status as 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  }
  await patient.save();
  return patient.toObject();
}
