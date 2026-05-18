import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

function emptyToUndefined(val: unknown) {
  if (val === '' || val === null || val === undefined) return undefined;
  return val;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  CLIENT_URL: z.string().url().optional().default('http://localhost:3000'),
  SEED_SUPERADMIN_EMAIL: z.string().email().optional(),
  SEED_SUPERADMIN_PASSWORD: z.string().min(8).optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.coerce.boolean().optional().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional().default('noreply@mrdonlineclinic.local'),
  AGORA_APP_ID: z.string().min(1).optional(),
  AGORA_APP_CERTIFICATE: z.string().min(1).optional(),
  IMAGEKIT_PUBLIC_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  IMAGEKIT_PRIVATE_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  IMAGEKIT_URL_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  cached = parsed.data;
  return cached;
}
