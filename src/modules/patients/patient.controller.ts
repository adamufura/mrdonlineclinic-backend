import type { Request, Response } from 'express';
import { AuthError, ValidationError } from '../../shared/errors';
import { ok } from '../../shared/envelope';
import * as svc from './patient.service';

export async function me(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.getMyProfile(req.user.id);
  return res.json(ok('Patient profile', data));
}

export async function patchMe(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.updateMyProfile(req.user.id, req.body);
  return res.json(ok('Profile updated', data));
}

export async function patchMedical(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.updateMyMedical(req.user.id, req.body);
  return res.json(ok('Medical info updated', data));
}

export async function patchHealthRecord(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.updateMyHealthRecord(req.user.id, req.body);
  return res.json(ok('Health record updated', data));
}

export async function patchEmergency(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.updateMyEmergencyContact(req.user.id, req.body);
  return res.json(ok('Emergency contact updated', data));
}

export async function patchAddress(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.updateMyAddress(req.user.id, req.body);
  return res.json(ok('Address updated', data));
}

export async function postPhoto(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  if (!req.file) throw new ValidationError('No file uploaded');
  const data = await svc.uploadMyPhoto(req.user.id, req.file);
  return res.json(ok('Photo uploaded', data));
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
  const result = await svc.listMyAppointments(req.user.id, page, limit, { status, from, to });
  return res.json(ok('Appointments', result.items, result.meta));
}

export async function myPrescriptions(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await svc.listMyPrescriptions(req.user.id, page, limit);
  return res.json(ok('Prescriptions', result.items, result.meta));
}

export async function adminList(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { page, limit, search } = req.query as unknown as { page: number; limit: number; search?: string };
  const result = await svc.listAllPatientsAdmin(page, limit, search);
  return res.json(ok('Patients', result.items, result.meta));
}

export async function adminGetById(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.getPatientByIdAdmin(req.user.role, req.params.id);
  return res.json(ok('Patient', data));
}

export async function adminCreate(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.createPatientByAdmin(req.user.id, req.body, req);
  return res.status(201).json(ok(data.message, data));
}

export async function adminPatch(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.updatePatientByAdmin(req.params.id, req.body);
  return res.json(ok('Patient updated', data));
}
