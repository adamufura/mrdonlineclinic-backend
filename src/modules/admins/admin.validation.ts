import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination';

export const inviteAdminSchema = z.object({
  email: z.string().email(),
});

export const adminIdParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

export const changeAdminRoleSchema = z.object({
  adminRole: z.enum(['SUPER_ADMIN', 'ADMIN']),
});

export const auditLogQuerySchema = paginationQuerySchema.extend({
  action: z.string().optional(),
});
