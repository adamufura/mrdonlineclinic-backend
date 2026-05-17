import {
  changePasswordSchema,
  registerPatientSchema,
  registerPractitionerSchema,
} from '../src/modules/auth/auth.validation';

describe('auth.validation', () => {
  it('rejects weak passwords', () => {
    const parsed = registerPatientSchema.safeParse({
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      phoneNumber: '+10000000000',
      password: 'short',
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts strong password', () => {
    const parsed = registerPatientSchema.safeParse({
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      phoneNumber: '+10000000000',
      password: 'Aa1!aaaa',
    });
    expect(parsed.success).toBe(true);
  });

  const validPractitionerBase = {
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.com',
    phoneNumber: '+10000000000',
    password: 'Aa1!aaaa',
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
      currentPassword: 'Aa1!aaaa',
      newPassword: 'Aa1!aaaa',
    });
    expect(parsed.success).toBe(false);
  });

  it('changePassword accepts when new password differs', () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: 'Aa1!aaaa',
      newPassword: 'Bb2@bbbb',
    });
    expect(parsed.success).toBe(true);
  });
});
