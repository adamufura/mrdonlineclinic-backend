import type { AdminPermission } from '../../config/admin-rbac';
import type { AppLanguage } from '../translation/translation.types';
import type { AuthRole, AdminRole } from '../../types/express';

export type SafeUser = {
  id: string;
  role: AuthRole;
  adminRole?: AdminRole;
  permissions?: AdminPermission[];
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: string;
  isEmailVerified: boolean;
  preferredLanguage: AppLanguage;
  lastLoginAt?: Date;
  profilePhotoUrl?: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};
