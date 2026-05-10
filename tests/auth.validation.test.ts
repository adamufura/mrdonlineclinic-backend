import {
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

  it('registerPractitioner requires at least one specialty id', () => {
    const parsed = registerPractitionerSchema.safeParse({
      ...validPractitionerBase,
      specialties: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('registerPractitioner rejects duplicate specialty ids', () => {
    const id = '507f1f77bcf86cd799439011';
    const parsed = registerPractitionerSchema.safeParse({
      ...validPractitionerBase,
      specialties: [id, id],
    });
    expect(parsed.success).toBe(false);
  });

  it('registerPractitioner accepts valid payload with specialties', () => {
    const parsed = registerPractitionerSchema.safeParse({
      ...validPractitionerBase,
      specialties: ['507f1f77bcf86cd799439011'],
    });
    expect(parsed.success).toBe(true);
  });
});
