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
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phoneNumber: z.string().min(5).max(30),
  password: strongPassword,
});

const mongoObjectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid specialty id');

/** Call GET /api/v1/specialties for options; send each specialty's `id`. */
export const registerPractitionerSchema = registerPatientSchema.extend({
  specialties: z
    .array(mongoObjectIdString)
    .min(1, 'Select at least one specialty')
    .max(20, 'Too many specialties')
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Duplicate specialty ids are not allowed',
    }),
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

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: strongPassword,
});

export const adminLoginSchema = loginSchema;

export const acceptAdminInviteSchema = z.object({
  token: z.string().min(1),
  password: strongPassword,
});
