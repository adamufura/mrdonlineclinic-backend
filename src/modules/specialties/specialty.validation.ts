import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination';

export const createSpecialtySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  icon: z.string().url().optional(),
});

export const updateSpecialtySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  icon: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

export const listSpecialtiesAdminQuerySchema = paginationQuerySchema.extend({
  activeOnly: z.coerce.boolean().optional(),
});

export const specialtyIdParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/),
});
