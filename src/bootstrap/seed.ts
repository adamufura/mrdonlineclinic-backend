import crypto from 'crypto';
import { logger } from '../config/logger';
import { AdminModel } from '../modules/users/user.model';
import { hashPassword } from '../services/password.service';
import { getEnv } from '../config/env';

/**
 * Creates the first Super Admin once per database: if any user with
 * adminRole SUPER_ADMIN already exists, this is a no-op (safe on every boot).
 */
export async function seedSuperAdmin(): Promise<void> {
  const env = getEnv();
  if (!env.SEED_SUPERADMIN_EMAIL || !env.SEED_SUPERADMIN_PASSWORD) {
    logger.debug('Super admin seed skipped (no SEED_SUPERADMIN_* env)');
    return;
  }

  const email = env.SEED_SUPERADMIN_EMAIL.toLowerCase();
  const alreadySeeded = await AdminModel.exists({ adminRole: 'SUPER_ADMIN' });
  if (alreadySeeded) {
    logger.debug('Super admin seed skipped (a SUPER_ADMIN already exists)');
    return;
  }

  const emailTaken = await AdminModel.exists({ email });
  if (emailTaken) {
    logger.warn({ email }, 'Cannot seed super admin: email already in use');
    return;
  }

  const passwordHash = await hashPassword(env.SEED_SUPERADMIN_PASSWORD);
  await AdminModel.create({
    firstName: 'Super',
    lastName: 'Admin',
    email,
    phoneNumber: `seed-${crypto.randomBytes(4).toString('hex')}`,
    passwordHash,
    status: 'ACTIVE',
    isEmailVerified: true,
    adminRole: 'SUPER_ADMIN',
  });

  logger.info({ email }, 'Super admin seeded (one-time for this database)');
}

export async function runBootstrap(): Promise<void> {
  await seedSuperAdmin();
}
