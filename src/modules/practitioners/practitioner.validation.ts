import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination';

export const updatePractitionerProfileSchema = z.object({
  bio: z.string().max(5000).optional(),
  yearsOfExperience: z.coerce.number().min(0).max(80).optional(),
  qualifications: z
    .array(
      z.object({
        degree: z.string(),
        institution: z.string(),
        year: z.coerce.number(),
      }),
    )
    .optional(),
  specialties: z.array(z.string().regex(/^[a-fA-F0-9]{24}$/)).optional(),
  consultationLanguages: z.array(z.string()).optional(),
});

export const listPractitionersQuerySchema = paginationQuerySchema.extend({
  specialtyId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
  search: z.string().optional(),
  sort: z.enum(['rating', 'experience', 'createdAt']).optional(),
});

export const practitionerIdParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

export const publicSlotsQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const createSlotSchema = z.object({
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});

export const createRecurringSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotDurationMinutes: z.number().int().min(10).max(240),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
});

export const materializeQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(12).default(4),
});

export const blockRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const listSlotsQuerySchema = paginationQuerySchema.extend({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.string().optional(),
});

export const slotIdParamSchema = z.object({
  slotId: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

export const verifyPractitionerSchema = z.object({
  verificationNotes: z.string().max(2000).optional(),
});

export const rejectPractitionerSchema = z.object({
  verificationNotes: z.string().min(1).max(2000),
});
