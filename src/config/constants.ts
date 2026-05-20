export const API_PREFIX = '/api/v1';

export const USER_ROLES = ['PATIENT', 'PRACTITIONER', 'ADMIN'] as const;
export const USER_STATUSES = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;

export const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'DEPUTY_DIRECTOR',
  'OPERATIONS',
  'MINISTRY_OFFICE',
  'ONBOARDING',
  'AUDITOR',
  /** @deprecated Legacy value — normalized to OPERATIONS in RBAC; not assignable on create. */
  'ADMIN',
] as const;

/** Roles that may be assigned when creating ministry staff (excludes legacy ADMIN). */
export const ASSIGNABLE_ADMIN_ROLES = [
  'SUPER_ADMIN',
  'DEPUTY_DIRECTOR',
  'OPERATIONS',
  'MINISTRY_OFFICE',
  'ONBOARDING',
  'AUDITOR',
] as const;

export const PRACTITIONER_VERIFICATION = ['UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED'] as const;

export const SLOT_STATUSES = ['OPEN', 'BOOKED', 'BLOCKED', 'CANCELLED'] as const;

export const APPOINTMENT_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'REJECTED',
] as const;

export const MESSAGE_TYPES = ['TEXT', 'IMAGE', 'FILE', 'VOICE', 'SYSTEM', 'CALL'] as const;

export const CALL_OUTCOMES = ['completed', 'rejected', 'missed', 'cancelled'] as const;

export const NOTIFICATION_TYPES = [
  'APPOINTMENT_BOOKED',
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_CANCELLED',
  'MESSAGE_RECEIVED',
  'PRESCRIPTION_ISSUED',
  'PRACTITIONER_VERIFIED',
  'PRACTITIONER_REJECTED',
  'ADMIN_INVITED',
  'EMAIL_VERIFICATION',
  'PASSWORD_RESET',
] as const;
