import type { Request } from 'express';
import mongoose from 'mongoose';
import type { Types } from 'mongoose';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { buildMeta, skipForPage } from '../../shared/pagination';
import { domainEvents } from '../../events/domain.events';
import { ChatRoomModel } from '../chat/chat-room.model';
import { createNotification } from '../notifications/notification.service';
import { SlotModel } from '../slots/slot.model';
import { AppointmentModel } from './appointment.model';

type ApptStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'REJECTED';

const transitions: Record<ApptStatus, Partial<Record<ApptStatus, { who: ('patient' | 'practitioner')[] }>>> = {
  PENDING: {
    CONFIRMED: { who: ['practitioner'] },
    REJECTED: { who: ['practitioner'] },
    CANCELLED: { who: ['patient', 'practitioner'] },
  },
  CONFIRMED: {
    IN_PROGRESS: { who: ['practitioner'] },
    CANCELLED: { who: ['patient', 'practitioner'] },
    NO_SHOW: { who: ['practitioner'] },
  },
  IN_PROGRESS: {
    COMPLETED: { who: ['practitioner'] },
    CANCELLED: { who: ['practitioner'] },
  },
  COMPLETED: {},
  CANCELLED: {},
  REJECTED: {},
  NO_SHOW: {},
};

export function refId(v: unknown): Types.ObjectId {
  if (v instanceof mongoose.Types.ObjectId) return v;
  if (v && typeof v === 'object' && '_id' in v) return (v as { _id: Types.ObjectId })._id;
  throw new ValidationError('Invalid reference');
}

function assertTransition(
  from: ApptStatus,
  to: ApptStatus,
  role: 'patient' | 'practitioner',
) {
  const rule = transitions[from]?.[to];
  if (!rule || !rule.who.includes(role)) {
    throw new ValidationError(`Illegal status transition from ${from} to ${to}`);
  }
}

export async function bookAppointment(
  patientId: Types.ObjectId,
  body: { slotId: string; reasonForVisit: string; symptoms?: string[] },
) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const slot = await SlotModel.findOneAndUpdate(
      { _id: body.slotId, status: 'OPEN' },
      { $set: { status: 'BOOKED' } },
      { new: true, session },
    );
    if (!slot) {
      await session.abortTransaction();
      throw new ConflictError('Slot is no longer available');
    }

    const [appt] = await AppointmentModel.create(
      [
        {
          patient: patientId,
          practitioner: slot.practitioner,
          slot: slot._id,
          scheduledStart: slot.startTime,
          scheduledEnd: slot.endTime,
          reasonForVisit: body.reasonForVisit,
          symptoms: body.symptoms ?? [],
          status: 'PENDING',
        },
      ],
      { session },
    );

    await SlotModel.updateOne({ _id: slot._id }, { $set: { appointment: appt._id } }, { session });
    await session.commitTransaction();

    await createNotification({
      recipient: slot.practitioner,
      type: 'APPOINTMENT_BOOKED',
      title: 'New appointment request',
      body: 'A patient booked an appointment pending your confirmation.',
      data: { appointmentId: String(appt._id) },
    });

    return appt.toObject();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function ensureChatRoomOnConfirmed(appt: {
  _id: Types.ObjectId;
  patient: Types.ObjectId;
  practitioner: Types.ObjectId;
}) {
  const existing = await ChatRoomModel.findOne({ appointment: appt._id });
  if (existing) return existing;
  const room = await ChatRoomModel.create({
    appointment: appt._id,
    participants: [appt.patient, appt.practitioner],
    isLocked: false,
  });
  await AppointmentModel.updateOne({ _id: appt._id }, { $set: { chatRoom: room._id } });
  return room;
}

export async function transitionAppointment(
  appointmentId: string,
  actor: { id: Types.ObjectId; role: 'patient' | 'practitioner' },
  next: ApptStatus,
  extras: { cancellationReason?: string; practitionerNotes?: string },
  _req: Request,
) {
  const appt = await AppointmentModel.findById(appointmentId);
  if (!appt) throw new NotFoundError('Appointment not found');

  const patientRef = refId(appt.patient);
  const practitionerRef = refId(appt.practitioner);
  const asPatient = patientRef.equals(actor.id);
  const asPractitioner = practitionerRef.equals(actor.id);
  if (!asPatient && !asPractitioner) throw new ForbiddenError();

  const role = asPatient ? 'patient' : 'practitioner';
  const current = appt.status as ApptStatus;
  assertTransition(current, next, role);

  if (next === 'CANCELLED') {
    appt.cancellationReason = extras.cancellationReason;
    appt.cancelledBy = actor.id;
    appt.cancelledAt = new Date();
    if (appt.slot) {
      await SlotModel.updateOne(
        { _id: appt.slot },
        { $set: { status: 'OPEN', appointment: null } },
      );
    }
  }

  if (next === 'REJECTED' && appt.slot) {
    await SlotModel.updateOne({ _id: appt.slot }, { $set: { status: 'OPEN', appointment: null } });
  }

  if (next === 'IN_PROGRESS') {
    appt.startedAt = new Date();
  }
  if (next === 'COMPLETED') {
    appt.completedAt = new Date();
    if (appt.chatRoom) {
      await ChatRoomModel.updateOne({ _id: appt.chatRoom }, { $set: { isLocked: true } });
    }
  }
  if (next === 'CONFIRMED') {
    await ensureChatRoomOnConfirmed({
      _id: appt._id,
      patient: patientRef,
      practitioner: practitionerRef,
    });
    await createNotification({
      recipient: patientRef,
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Appointment confirmed',
      body: 'Your practitioner confirmed the appointment.',
      data: { appointmentId: String(appt._id) },
    });
    domainEvents.emitTyped('AppointmentConfirmed', {
      appointmentId: String(appt._id),
      patientId: String(patientRef),
      practitionerId: String(practitionerRef),
    });
  }

  if (extras.practitionerNotes !== undefined && asPractitioner) {
    appt.practitionerNotes = extras.practitionerNotes;
  }

  appt.status = next;
  await appt.save();

  if (next === 'CANCELLED') {
    domainEvents.emitTyped('AppointmentCancelled', {
      appointmentId: String(appt._id),
      patientId: String(patientRef),
      practitionerId: String(practitionerRef),
    });
  }

  return appt.toObject();
}

export async function rescheduleAppointment(
  patientId: Types.ObjectId,
  appointmentId: string,
  newSlotId: string,
) {
  const appt = await AppointmentModel.findById(appointmentId);
  if (!appt || !refId(appt.patient).equals(patientId)) throw new NotFoundError('Appointment not found');
  if (!['PENDING', 'CONFIRMED'].includes(appt.status)) {
    throw new ValidationError('Cannot reschedule this appointment');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const newSlot = await SlotModel.findOneAndUpdate(
      { _id: newSlotId, status: 'OPEN' },
      { $set: { status: 'BOOKED' } },
      { new: true, session },
    );
    if (!newSlot) {
      await session.abortTransaction();
      throw new ConflictError('New slot not available');
    }

    const oldSlotId = appt.slot;
    if (oldSlotId) {
      await SlotModel.updateOne({ _id: oldSlotId }, { $set: { status: 'OPEN', appointment: null } }, { session });
    }

    appt.slot = newSlot._id;
    appt.scheduledStart = newSlot.startTime;
    appt.scheduledEnd = newSlot.endTime;
    appt.status = 'PENDING';
    await appt.save({ session });

    await SlotModel.updateOne({ _id: newSlot._id }, { $set: { appointment: appt._id } }, { session });
    await session.commitTransaction();
    return appt.toObject();
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

export async function getAppointmentForUser(appointmentId: string, userId: Types.ObjectId) {
  const appt = await AppointmentModel.findById(appointmentId)
    .populate('patient', 'firstName lastName email phoneNumber')
    .populate('practitioner', 'firstName lastName email profilePhotoUrl')
    .populate('slot');
  if (!appt) throw new NotFoundError('Appointment not found');
  const pId = refId(appt.patient);
  const prId = refId(appt.practitioner);
  if (!pId.equals(userId) && !prId.equals(userId)) throw new ForbiddenError();
  const { enrichAppointmentDoc } = await import('../../services/translation.service');
  const { getUserPreferredLanguage } = await import('../../shared/language');
  const viewerLanguage = await getUserPreferredLanguage(userId);
  return enrichAppointmentDoc(appt.toObject() as Record<string, unknown>, viewerLanguage);
}

export async function listForPatient(userId: Types.ObjectId, page: number, limit: number, filters: { status?: string; from?: Date; to?: Date }) {
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
    .populate('practitioner', 'firstName lastName profilePhotoUrl')
    .lean();
  return { items: rows, meta: buildMeta(total, page, limit) };
}

export async function updatePractitionerNotes(appointmentId: string, practitionerId: Types.ObjectId, notes: string) {
  const appt = await AppointmentModel.findById(appointmentId);
  if (!appt) throw new NotFoundError('Appointment not found');
  if (!refId(appt.practitioner).equals(practitionerId)) throw new ForbiddenError();
  appt.practitionerNotes = notes;
  await appt.save();
  return appt.toObject();
}

export async function listForPractitioner(
  userId: Types.ObjectId,
  page: number,
  limit: number,
  filters: { status?: string; from?: Date; to?: Date },
) {
  const q: Record<string, unknown> = { practitioner: userId };
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
    .populate('patient', 'firstName lastName profilePhotoUrl')
    .lean();
  return { items: rows, meta: buildMeta(total, page, limit) };
}
