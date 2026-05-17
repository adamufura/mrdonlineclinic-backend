import {
  changePasswordSchema,
  registerPatientSchema,
  registerPractitionerSchema,
} from '../src/modules/auth/auth.validation';

describe('auth.validation', () => {
  const validBase = {
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.com',
    phoneNumber: '+10000000000',
  };

  it('rejects passwords shorter than 6 characters', () => {
    const parsed = registerPatientSchema.safeParse({
      ...validBase,
      password: 'abc12',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects passwords longer than 12 characters', () => {
    const parsed = registerPatientSchema.safeParse({
      ...validBase,
      password: 'abcdefghijklm',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects passwords with invalid characters', () => {
    const parsed = registerPatientSchema.safeParse({
      ...validBase,
      password: 'pass 12',
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts 6-character alphanumeric password', () => {
    const parsed = registerPatientSchema.safeParse({
      ...validBase,
      password: 'abc123',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts mixed letters numbers and symbols within 12 chars', () => {
    const parsed = registerPatientSchema.safeParse({
      ...validBase,
      password: 'Pass1!',
    });
    expect(parsed.success).toBe(true);
  });

  const validPractitionerBase = {
    ...validBase,
    password: 'abc123',
  };

  it('registerPractitioner requires exactly one specialty id', () => {
    expect(
      registerPractitionerSchema.safeParse({
        ...validPractitionerBase,
        specialties: [],
      }).success,
    ).toBe(false);
    expect(
      registerPractitionerSchema.safeParse({
        ...validPractitionerBase,
        specialties: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439011'],
      }).success,
    ).toBe(false);
    expect(
      registerPractitionerSchema.safeParse({
        ...validPractitionerBase,
        specialties: ['507f1f77bcf86cd799439011', '507f191e810c19729de860ea'],
      }).success,
    ).toBe(false);
  });

  it('registerPractitioner accepts valid payload with one specialty', () => {
    const parsed = registerPractitionerSchema.safeParse({
      ...validPractitionerBase,
      specialties: ['507f1f77bcf86cd799439011'],
    });
    expect(parsed.success).toBe(true);
  });

  it('changePassword rejects when new password matches current', () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: 'abc123',
      newPassword: 'abc123',
    });
    expect(parsed.success).toBe(false);
  });

  it('changePassword accepts when new password differs', () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: 'abc123',
      newPassword: 'xyz789',
    });
    expect(parsed.success).toBe(true);
  });
});
