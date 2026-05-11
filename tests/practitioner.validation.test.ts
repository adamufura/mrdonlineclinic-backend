import { updatePractitionerProfileSchema } from '../src/modules/practitioners/practitioner.validation';

describe('practitioner.validation', () => {
  it('updatePractitionerProfile allows bio-only updates without middle name', () => {
    const parsed = updatePractitionerProfileSchema.safeParse({ bio: 'Hello' });
    expect(parsed.success).toBe(true);
  });

  it('updatePractitionerProfile requires middle name when updating identity fields', () => {
    expect(
      updatePractitionerProfileSchema.safeParse({
        firstName: 'A',
        lastName: 'B',
        phoneNumber: '+10000000000',
      }).success,
    ).toBe(false);
    expect(
      updatePractitionerProfileSchema.safeParse({
        firstName: 'A',
        middleName: 'M',
        lastName: 'B',
        phoneNumber: '+10000000000',
      }).success,
    ).toBe(true);
  });
});
