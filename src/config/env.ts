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
  /** Comma-separated browser origins (credentials). Default covers local web (:5173) + admin (:5174) + API port. Set explicitly in production. */
  CORS_ORIGINS: z
    .string()
    .optional()
    .default(
      'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174,http://localhost:3000',
    ),
  SEED_SUPERADMIN_EMAIL: z.string().email().optional(),
  SEED_SUPERADMIN_PASSWORD: z.string().min(8).optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.coerce.boolean().optional().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional().default('noreply@mrdonlineclinic.local'),
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

/**
 * Local Vite + tooling origins — unioned with `CORS_ORIGINS` unless `CORS_STRICT=true`.
 * The origin of `CLIENT_URL` is always included so production can set one public web URL
 * (`CLIENT_URL=https://your-spa.example`) without duplicating it in `CORS_ORIGINS`.
 * If users can open the same site over HTTP and HTTPS, list both origins in `CORS_ORIGINS`
 * (scheme matters for the browser `Origin` header).
 */
const LOCAL_BROWSER_DEV_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5174',
  'http://localhost:3000',
] as const;

function clientUrlOrigin(): string | undefined {
  try {
    return new URL(getEnv().CLIENT_URL).origin;
  } catch {
    return undefined;
  }
}

export function parseCorsOrigins(): string[] {
  const raw = getEnv().CORS_ORIGINS;
  const fromEnv = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const clientOrigin = clientUrlOrigin();
  const fromClient = clientOrigin ? [clientOrigin] : [];
  const strict = process.env.CORS_STRICT === '1' || process.env.CORS_STRICT === 'true';
  if (strict) {
    const base = fromEnv.length > 0 ? fromEnv : [...LOCAL_BROWSER_DEV_ORIGINS];
    return [...new Set([...base, ...fromClient])];
  }
  return [...new Set([...fromEnv, ...LOCAL_BROWSER_DEV_ORIGINS, ...fromClient])];
}
