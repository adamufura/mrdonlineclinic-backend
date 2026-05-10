import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination';

export const updatePatientProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phoneNumber: z.string().min(5).max(30).optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_SAY']).optional(),
  bloodGroup: z
    .enum(['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN'])
    .optional(),
});

export const updatePatientMedicalSchema = z.object({
  allergies: z.array(z.string()).optional(),
  chronicConditions: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional(),
  emergencyContact: z
    .object({
      name: z.string(),
      relationship: z.string(),
      phoneNumber: z.string(),
    })
    .optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
    })
    .optional(),
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
