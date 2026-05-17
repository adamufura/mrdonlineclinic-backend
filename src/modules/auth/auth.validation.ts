import { z } from 'zod';

const strongPassword = z
  .string()
  .min(8)
  .max(128)
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    'Password must include uppercase, lowercase, number, and special character',
  );

export const registerPatientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phoneNumber: z.string().min(5).max(30),
  password: strongPassword,
});

const mongoObjectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid specialty id');

/** Call GET /api/v1/specialties for options; send exactly one specialty `id` in the array. */
export const registerPractitionerSchema = registerPatientSchema.extend({
  specialties: z.array(mongoObjectIdString).length(1, 'Select exactly one specialty'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  /** Optional when refresh token is sent as httpOnly cookie (web SPA). */
  refreshToken: z.string().min(1).optional(),
});

export const logoutSchema = refreshSchema;

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: strongPassword,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: strongPassword,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'New password must be different from your current password',
    path: ['newPassword'],
  });

export const adminLoginSchema = loginSchema;

export const acceptAdminInviteSchema = z.object({
  token: z.string().min(1),
  password: strongPassword,
});
