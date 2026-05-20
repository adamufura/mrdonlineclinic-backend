import { z } from 'zod';
import { ASSIGNABLE_ADMIN_ROLES } from '../../config/constants';
import { paginationQuerySchema } from '../../shared/pagination';

export const createAdminSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  email: z.string().email().max(255),
  phoneNumber: z.string().min(5).max(30),
  adminRole: z.enum(ASSIGNABLE_ADMIN_ROLES),
});

export const adminIdParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

export const changeAdminRoleSchema = z.object({
  adminRole: z.enum(ASSIGNABLE_ADMIN_ROLES),
});

export const auditLogQuerySchema = paginationQuerySchema.extend({
  action: z.string().optional(),
});
