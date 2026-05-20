import { z } from 'zod';

export const callTokenSchema = z.object({
  appointmentId: z.string().regex(/^[a-fA-F0-9]{24}$/),
  callType: z.enum(['audio', 'video']),
});

export const callActionSchema = z.object({
  appointmentId: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

export const callEndSchema = callActionSchema.extend({
  outcome: z.enum(['completed', 'rejected', 'missed', 'cancelled']).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  callType: z.enum(['audio', 'video']).optional(),
});

export const callRejectSchema = callActionSchema.extend({
  callType: z.enum(['audio', 'video']).optional(),
});
