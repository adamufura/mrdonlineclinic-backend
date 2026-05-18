import { z } from 'zod';

export const callTokenSchema = z.object({
  appointmentId: z.string().regex(/^[a-fA-F0-9]{24}$/),
  callType: z.enum(['audio', 'video']),
});

export const callActionSchema = z.object({
  appointmentId: z.string().regex(/^[a-fA-F0-9]{24}$/),
});
