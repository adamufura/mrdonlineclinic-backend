import type { AuthRole, AdminRole } from '../../types/express';

export type SafeUser = {
  id: string;
  role: AuthRole;
  adminRole?: AdminRole;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: string;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};
