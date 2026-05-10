import type { Request, Response } from 'express';
import { AuthError } from '../../shared/errors';
import { ok } from '../../shared/envelope';
import * as svc from './appointment.service';

export async function book(req: Request, res: Response) {
  if (!req.user || req.user.role !== 'PATIENT') throw new AuthError();
  const data = await svc.bookAppointment(req.user.id, req.body);
  return res.status(201).json(ok('Appointment booked', data));
}

export async function getById(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.getAppointmentForUser(req.params.id, req.user.id);
  return res.json(ok('Appointment', data));
}

export async function confirm(req: Request, res: Response) {
  if (!req.user || req.user.role !== 'PRACTITIONER') throw new AuthError();
  const data = await svc.transitionAppointment(req.params.id, { id: req.user.id, role: 'practitioner' }, 'CONFIRMED', {}, req);
  return res.json(ok('Appointment confirmed', data));
}

export async function reject(req: Request, res: Response) {
  if (!req.user || req.user.role !== 'PRACTITIONER') throw new AuthError();
  const data = await svc.transitionAppointment(
    req.params.id,
    { id: req.user.id, role: 'practitioner' },
    'REJECTED',
    {},
    req,
  );
  return res.json(ok('Appointment rejected', data));
}

export async function start(req: Request, res: Response) {
  if (!req.user || req.user.role !== 'PRACTITIONER') throw new AuthError();
  const data = await svc.transitionAppointment(
    req.params.id,
    { id: req.user.id, role: 'practitioner' },
    'IN_PROGRESS',
    {},
    req,
  );
  return res.json(ok('Appointment in progress', data));
}

export async function complete(req: Request, res: Response) {
  if (!req.user || req.user.role !== 'PRACTITIONER') throw new AuthError();
  const data = await svc.transitionAppointment(
    req.params.id,
    { id: req.user.id, role: 'practitioner' },
    'COMPLETED',
    {},
    req,
  );
  return res.json(ok('Appointment completed', data));
}

export async function noShow(req: Request, res: Response) {
  if (!req.user || req.user.role !== 'PRACTITIONER') throw new AuthError();
  const data = await svc.transitionAppointment(
    req.params.id,
    { id: req.user.id, role: 'practitioner' },
    'NO_SHOW',
    {},
    req,
  );
  return res.json(ok('Marked as no-show', data));
}

export async function cancel(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  if (req.user.role !== 'PATIENT' && req.user.role !== 'PRACTITIONER') throw new AuthError();
  const role = req.user.role === 'PATIENT' ? 'patient' : 'practitioner';
  const data = await svc.transitionAppointment(
    req.params.id,
    { id: req.user.id, role },
    'CANCELLED',
    { cancellationReason: req.body.cancellationReason },
    req,
  );
  return res.json(ok('Appointment cancelled', data));
}

export async function reschedule(req: Request, res: Response) {
  if (!req.user || req.user.role !== 'PATIENT') throw new AuthError();
  const data = await svc.rescheduleAppointment(req.user.id, req.params.id, req.body.newSlotId);
  return res.json(ok('Appointment rescheduled', data));
}

export async function practitionerNotes(req: Request, res: Response) {
  if (!req.user || req.user.role !== 'PRACTITIONER') throw new AuthError();
  const data = await svc.updatePractitionerNotes(req.params.id, req.user.id, req.body.practitionerNotes);
  return res.json(ok('Notes updated', data));
}
