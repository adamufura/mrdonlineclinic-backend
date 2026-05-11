import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination';

export const listRoomsQuerySchema = paginationQuerySchema;

export const roomIdParamSchema = z.object({
  roomId: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

export const messageIdParamSchema = z.object({
  roomId: z.string().regex(/^[a-fA-F0-9]{24}$/),
  messageId: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

export const listMessagesQuerySchema = paginationQuerySchema.extend({
  before: z.coerce.date().optional(),
});

export const postMessageHttpSchema = z
  .object({
    content: z.string().min(1).max(10000).optional(),
    attachments: z
      .array(
        z.object({
          url: z.string().url(),
          type: z.string().optional(),
          fileName: z.string().optional(),
          size: z.number().optional(),
        }),
      )
      .optional(),
    messageType: z.enum(['TEXT', 'IMAGE', 'FILE', 'SYSTEM']).optional(),
  })
  .refine((d) => Boolean(d.content?.trim()) || (d.attachments && d.attachments.length > 0), {
    message: 'Provide content or at least one attachment',
  });
