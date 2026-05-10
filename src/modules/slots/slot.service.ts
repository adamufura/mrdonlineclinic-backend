import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { buildMeta, skipForPage } from '../../shared/pagination';
import { PractitionerModel } from '../users/user.model';
import { RecurringAvailabilityModel } from './recurring-availability.model';
import { SlotModel } from './slot.model';

dayjs.extend(utc);

function parseHmOnDateUtc(day: dayjs.Dayjs, hm: string): dayjs.Dayjs {
  const [h, m] = hm.split(':').map(Number);
  return day.utc().startOf('day').hour(h).minute(m).second(0).millisecond(0);
}

export async function createOneOffSlot(practitionerId: mongoose.Types.ObjectId, startTime: Date, endTime: Date) {
  const start = dayjs(startTime);
  const end = dayjs(endTime);
  if (!end.isAfter(start)) throw new ConflictError('endTime must be after startTime');
  const durationMinutes = end.diff(start, 'minute');
  const date = start.utc().startOf('day').toDate();
  try {
    const slot = await SlotModel.create({
      practitioner: practitionerId,
      date,
      startTime,
      endTime,
      durationMinutes,
      status: 'OPEN',
    });
    return slot.toObject();
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: number }).code === 11000) {
      throw new ConflictError('Slot overlaps existing start time');
    }
    throw e;
  }
}

export async function listOwnSlots(
  practitionerId: mongoose.Types.ObjectId,
  page: number,
  limit: number,
  filters: { from?: Date; to?: Date; status?: string },
) {
  const q: Record<string, unknown> = { practitioner: practitionerId };
  if (filters.status) q.status = filters.status;
  if (filters.from || filters.to) {
    q.startTime = {};
    if (filters.from) (q.startTime as Record<string, Date>).$gte = filters.from;
    if (filters.to) (q.startTime as Record<string, Date>).$lte = filters.to;
  }
  const total = await SlotModel.countDocuments(q);
  const rows = await SlotModel.find(q)
    .sort({ startTime: 1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .lean();
  return { items: rows, meta: buildMeta(total, page, limit) };
}

export async function deleteSlotIfUnbooked(practitionerId: mongoose.Types.ObjectId, slotId: string) {
  const slot = await SlotModel.findById(slotId);
  if (!slot) throw new NotFoundError('Slot not found');
  if (!slot.practitioner.equals(practitionerId)) throw new ForbiddenError();
  if (slot.status !== 'OPEN') throw new ConflictError('Only open unbooked slots can be deleted');
  await slot.deleteOne();
  return { message: 'Slot deleted' };
}

export async function createRecurringRule(
  practitionerId: mongoose.Types.ObjectId,
  body: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMinutes: number;
    validFrom: Date;
    validUntil?: Date;
  },
) {
  const doc = await RecurringAvailabilityModel.create({
    practitioner: practitionerId,
    ...body,
    isActive: true,
  });
  return doc.toObject();
}

export async function materializeRecurring(practitionerId: mongoose.Types.ObjectId, weeks: number) {
  const rules = await RecurringAvailabilityModel.find({ practitioner: practitionerId, isActive: true });
  let created = 0;
  const groupId = uuidv4();
  const horizon = dayjs.utc().add(weeks, 'week').endOf('day');

  for (const rule of rules) {
    let cursor = dayjs.utc(rule.validFrom).startOf('day');
    const until = rule.validUntil ? dayjs.utc(rule.validUntil) : horizon;
    while (cursor.isBefore(until) && cursor.isBefore(horizon)) {
      if (cursor.day() === rule.dayOfWeek) {
        let slotStart = parseHmOnDateUtc(cursor, rule.startTime);
        const dayEnd = parseHmOnDateUtc(cursor, rule.endTime);
        for (let n = 0; n < 200; n += 1) {
          const slotEnd = slotStart.add(rule.slotDurationMinutes, 'minute');
          if (slotEnd.isAfter(dayEnd)) break;
          try {
            await SlotModel.create({
              practitioner: practitionerId,
              date: slotStart.utc().startOf('day').toDate(),
              startTime: slotStart.toDate(),
              endTime: slotEnd.toDate(),
              durationMinutes: rule.slotDurationMinutes,
              status: 'OPEN',
              recurrenceGroupId: groupId,
            });
            created += 1;
          } catch {
            /* duplicate slot — skip */
          }
          slotStart = slotEnd;
        }
      }
      cursor = cursor.add(1, 'day');
    }
  }
  return { created, recurrenceGroupId: groupId };
}

export async function blockDateRange(practitionerId: mongoose.Types.ObjectId, from: Date, to: Date) {
  let cursor = dayjs.utc(from).startOf('day');
  const end = dayjs.utc(to).endOf('day');
  let created = 0;
  while (cursor.isBefore(end)) {
    const startTime = cursor.toDate();
    const endTime = cursor.endOf('day').toDate();
    await SlotModel.create({
      practitioner: practitionerId,
      date: cursor.toDate(),
      startTime,
      endTime,
      durationMinutes: 24 * 60,
      status: 'BLOCKED',
    }).catch(() => undefined);
    created += 1;
    cursor = cursor.add(1, 'day');
  }
  return { blockedDays: created };
}

export async function listPublicOpenSlots(practitionerId: string, from: Date, to: Date) {
  const prac = await PractitionerModel.findOne({
    _id: practitionerId,
    role: 'PRACTITIONER',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
  }).lean();
  if (!prac) throw new NotFoundError('Practitioner not found');

  const slots = await SlotModel.find({
    practitioner: practitionerId,
    status: 'OPEN',
    startTime: { $gte: from, $lte: to },
  })
    .sort({ startTime: 1 })
    .lean();
  return slots;
}
