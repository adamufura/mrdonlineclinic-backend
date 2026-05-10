import { z } from 'zod';

export const createReviewSchema = z.object({
  appointmentId: z.string().regex(/^[a-fA-F0-9]{24}$/),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(4000).optional(),
});

export const hideReviewSchema = z.object({
  isVisible: z.boolean(),
});

export const reviewIdParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/),
});
