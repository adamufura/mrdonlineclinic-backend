import type { Request, Response } from 'express';
import { AuthError, ValidationError } from '../../shared/errors';
import { ok } from '../../shared/envelope';
import * as appointmentSvc from '../appointments/appointment.service';
import * as slotSvc from '../slots/slot.service';
import * as svc from './practitioner.service';

export async function listDirectory(req: Request, res: Response) {
  const { page, limit, specialtyId, search, location, date, sort } = req.query as unknown as {
    page: number;
    limit: number;
    specialtyId?: string;
    search?: string;
    location?: string;
    date?: string;
    sort?: 'rating' | 'experience' | 'createdAt';
  };
  const result = await svc.listDirectory({ page, limit, specialtyId, search, location, date, sort });
  return res.json(ok('Practitioners', result.items, result.meta));
}

export async function publicProfile(req: Request, res: Response) {
  const data = await svc.getPublicProfile(req.params.id);
  return res.json(ok('Practitioner', data));
}

export async function publicSlots(req: Request, res: Response) {
  const { from, to } = req.query as unknown as { from: Date; to: Date };
  const data = await svc.getPublicSlots(req.params.id, from, to);
  return res.json(ok('Slots', data));
}

export async function me(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.getMe(req.user.id);
  return res.json(ok('Practitioner profile', data));
}

export async function patchMe(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.updateMyProfile(req.user.id, req.body);
  return res.json(ok('Profile updated', data));
}

export async function postCredentials(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  if (!req.file) throw new ValidationError('No file uploaded');
  const data = await svc.uploadCredentials(req.user.id, req.file);
  return res.json(ok('Credentials uploaded', data));
}

export async function postPhoto(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  if (!req.file) throw new ValidationError('No file uploaded');
  const data = await svc.uploadPhoto(req.user.id, req.file);
  return res.json(ok('Photo uploaded', data));
}

export async function myPatients(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.listConsultedPatients(req.user.id);
  return res.json(ok('Patients', data));
}

export async function mySlots(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { page, limit, from, to, status } = req.query as unknown as {
    page: number;
    limit: number;
    from?: Date;
    to?: Date;
    status?: string;
  };
  const result = await slotSvc.listOwnSlots(req.user.id, page, limit, { from, to, status });
  return res.json(ok('Slots', result.items, result.meta));
}

export async function createSlot(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await slotSvc.createOneOffSlot(req.user.id, req.body.startTime, req.body.endTime);
  return res.status(201).json(ok('Slot created', data));
}

export async function deleteSlot(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await slotSvc.deleteSlotIfUnbooked(req.user.id, req.params.slotId);
  return res.json(ok(data.message, data));
}

export async function createRecurring(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await slotSvc.createRecurringRule(req.user.id, req.body);
  return res.status(201).json(ok('Recurring rule created', data));
}

export async function materialize(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { weeks } = req.query as unknown as { weeks: number };
  const data = await slotSvc.materializeRecurring(req.user.id, weeks);
  return res.json(ok('Slots materialized', data));
}

export async function blockRange(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await slotSvc.blockDateRange(req.user.id, req.body.from, req.body.to);
  return res.json(ok('Range blocked', data));
}

export async function myAppointments(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { page, limit, status, from, to } = req.query as unknown as {
    page: number;
    limit: number;
    status?: string;
    from?: Date;
    to?: Date;
  };
  const result = await appointmentSvc.listForPractitioner(req.user.id, page, limit, { status, from, to });
  return res.json(ok('Appointments', result.items, result.meta));
}

export async function adminList(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await svc.listAllPractitionersAdmin(page, limit);
  return res.json(ok('Practitioners', result.items, result.meta));
}

export async function adminGet(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.getPractitionerAdmin(req.user.role, req.params.id);
  return res.json(ok('Practitioner', data));
}

export async function adminVerify(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.verifyPractitioner(req.user.id, req.params.id, req.body.verificationNotes, req);
  return res.json(ok('Practitioner verified', data));
}

export async function adminReject(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.rejectPractitioner(req.user.id, req.params.id, req.body.verificationNotes, req);
  return res.json(ok('Practitioner rejected', data));
}

export async function adminSuspend(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.suspendPractitioner(req.user.id, req.params.id, req);
  return res.json(ok('Practitioner suspended', data));
}
