import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination';

export const issuePrescriptionSchema = z.object({
  appointmentId: z.string().regex(/^[a-fA-F0-9]{24}$/),
  diagnosis: z.string().min(1).max(4000),
  medications: z.array(
    z.object({
      drugName: z.string().min(1),
      dosage: z.string().min(1),
      frequency: z.string().min(1),
      duration: z.string().min(1),
      route: z.string().optional(),
      instructions: z.string().optional(),
    }),
  ),
  additionalNotes: z.string().max(8000).optional(),
});

export const prescriptionIdParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

export const listPrescriptionsQuerySchema = paginationQuerySchema;
