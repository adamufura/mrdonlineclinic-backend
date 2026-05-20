import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination';

export const updatePatientProfileSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    middleName: z.string().max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phoneNumber: z.string().min(5).max(30).optional(),
    dateOfBirth: z.coerce.date().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_SAY']).optional(),
    bloodGroup: z
      .enum(['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN'])
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

const emergencyContactSchema = z.object({
  name: z.string().min(1).max(120),
  relationship: z.string().min(1).max(80),
  phoneNumber: z.string().min(5).max(30),
});

const addressSchema = z.object({
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
});

export const updatePatientMedicalSchema = z.object({
  allergies: z.array(z.string()).optional(),
  chronicConditions: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional(),
  emergencyContact: emergencyContactSchema.nullable().optional(),
  address: addressSchema.nullable().optional(),
});

/** PATCH /patients/me/medical/health-record — replaces list fields (empty array clears). */
export const updatePatientHealthRecordSchema = z.object({
  allergies: z.array(z.string().max(200)),
  chronicConditions: z.array(z.string().max(200)),
  currentMedications: z.array(z.string().max(200)),
});

/** PATCH /patients/me/medical/emergency — set contact or null to remove. */
export const updatePatientEmergencySchema = z.object({
  emergencyContact: z.union([emergencyContactSchema, z.null()]),
});

/** PATCH /patients/me/medical/address — set address or null to remove. */
export const updatePatientAddressSchema = z.object({
  address: z.union([addressSchema, z.null()]),
});

export const listPatientAppointmentsQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const adminPatientIdParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

export const listPatientsAdminQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
});

export const createPatientAdminSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  email: z.string().email().max(255),
  phoneNumber: z.string().min(5).max(30),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_SAY']).optional(),
});
