import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination';

export const notificationIdParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});
