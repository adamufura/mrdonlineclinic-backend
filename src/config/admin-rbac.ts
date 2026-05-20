import { ADMIN_ROLES } from './constants';

export const DEFAULT_STAFF_PASSWORD = 'mrdclinic';

export const ADMIN_PERMISSIONS = [
  'stats:read',
  'audit:read',
  'patients:read',
  'patients:write',
  'practitioners:read',
  'practitioners:write',
  'practitioners:verify',
  'practitioners:onboard',
  'admins:read',
  'admins:write',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Legacy DB value — treated as OPERATIONS for permissions. */
export const LEGACY_ADMIN_ROLE = 'ADMIN' as const;

export function normalizeAdminRole(role: string | undefined): AdminRole | undefined {
  if (!role) return undefined;
  if (role === LEGACY_ADMIN_ROLE) return 'OPERATIONS';
  if ((ADMIN_ROLES as readonly string[]).includes(role)) return role as AdminRole;
  return undefined;
}

const ALL: AdminPermission[] = [...ADMIN_PERMISSIONS];

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: ALL,
  DEPUTY_DIRECTOR: [
    'stats:read',
    'audit:read',
    'patients:read',
    'patients:write',
    'practitioners:read',
    'practitioners:write',
    'practitioners:verify',
    'practitioners:onboard',
    'admins:read',
  ],
  OPERATIONS: [
    'stats:read',
    'audit:read',
    'patients:read',
    'patients:write',
    'practitioners:read',
    'practitioners:write',
    'practitioners:verify',
    'practitioners:onboard',
  ],
  MINISTRY_OFFICE: ['stats:read', 'audit:read', 'patients:read', 'practitioners:read'],
  ONBOARDING: [
    'stats:read',
    'patients:read',
    'patients:write',
    'practitioners:read',
    'practitioners:onboard',
    'practitioners:verify',
  ],
  AUDITOR: ['stats:read', 'audit:read', 'patients:read', 'practitioners:read'],
  ADMIN: [
    'stats:read',
    'audit:read',
    'patients:read',
    'patients:write',
    'practitioners:read',
    'practitioners:write',
    'practitioners:verify',
    'practitioners:onboard',
  ],
};

export function getPermissionsForRole(role: string | undefined): AdminPermission[] {
  const normalized = normalizeAdminRole(role);
  if (!normalized) return [];
  return ROLE_PERMISSIONS[normalized] ?? [];
}

export function roleHasPermission(role: string | undefined, permission: AdminPermission): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function canAssignAdminRole(actorRole: string | undefined, targetRole: AdminRole): boolean {
  const actor = normalizeAdminRole(actorRole);
  if (actor === 'SUPER_ADMIN') return true;
  if (actor === 'DEPUTY_DIRECTOR') return targetRole !== 'SUPER_ADMIN';
  return false;
}

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Administrator',
  DEPUTY_DIRECTOR: 'Deputy Director',
  OPERATIONS: 'Operations Office',
  MINISTRY_OFFICE: 'Ministry Office',
  ONBOARDING: 'Onboarding Officer',
  AUDITOR: 'Auditor',
  ADMIN: 'Administrator (legacy)',
};
