import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination';

/** Express query values are often empty strings — treat as undefined. */
function queryStringOptional<T extends z.ZodTypeAny>(inner: T) {
  return z.preprocess((v) => {
    if (v === undefined || v === null || v === '') return undefined;
    return v;
  }, inner.optional());
}

export const updatePractitionerProfileSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    middleName: z.string().max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phoneNumber: z.string().min(5).max(30).optional(),
    licenseNumber: z.string().min(2).max(80).optional(),
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
    practiceLocation: z
      .object({
        city: z.string().max(120).optional(),
        state: z.string().max(120).optional(),
        country: z.string().max(120).optional(),
      })
      .optional(),
  })
  .superRefine((d, ctx) => {
    const touchesIdentity =
      d.firstName !== undefined ||
      d.lastName !== undefined ||
      d.phoneNumber !== undefined ||
      d.middleName !== undefined;
    if (!touchesIdentity) return;
    const m = d.middleName != null ? String(d.middleName).trim() : '';
    if (m.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Middle name is required when updating your name or phone',
        path: ['middleName'],
      });
    }
  });

export const listPractitionersQuerySchema = paginationQuerySchema.extend({
  specialtyId: queryStringOptional(z.string().regex(/^[a-fA-F0-9]{24}$/)),
  search: queryStringOptional(z.string().max(200)),
  location: queryStringOptional(z.string().max(120)),
  /** YYYY-MM-DD — practitioners with at least one OPEN slot overlapping this calendar day (UTC). */
  date: queryStringOptional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
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

const mongoObjectIdString = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const createPractitionerAdminSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  email: z.string().email().max(255),
  phoneNumber: z.string().min(5).max(30),
  specialties: z.array(mongoObjectIdString).min(1).max(5),
  licenseNumber: z.string().min(2).max(80).optional(),
  bio: z.string().max(5000).optional(),
  yearsOfExperience: z.coerce.number().min(0).max(80).optional(),
  autoVerify: z.boolean().optional(),
});

export const updatePractitionerAdminSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phoneNumber: z.string().min(5).max(30).optional(),
  licenseNumber: z.string().min(2).max(80).optional(),
  bio: z.string().max(5000).optional(),
  yearsOfExperience: z.coerce.number().min(0).max(80).optional(),
  specialties: z.array(mongoObjectIdString).optional(),
  isAvailableForBooking: z.boolean().optional(),
});
