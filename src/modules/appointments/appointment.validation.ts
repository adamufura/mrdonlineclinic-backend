import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination';

export const bookAppointmentSchema = z.object({
  slotId: z.string().regex(/^[a-fA-F0-9]{24}$/),
  reasonForVisit: z.string().min(1).max(2000),
  symptoms: z.array(z.string()).optional(),
});

export const appointmentIdParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

export const rescheduleSchema = z.object({
  newSlotId: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

export const cancelSchema = z.object({
  cancellationReason: z.string().min(1).max(2000),
});

export const practitionerNotesSchema = z.object({
  practitionerNotes: z.string().max(10000),
});

export const listAppointmentsQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
