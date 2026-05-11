import { updatePatientProfileSchema } from '../src/modules/patients/patient.validation';

describe('patient.validation', () => {
  it('updatePatientProfile allows non-identity fields without middle name', () => {
    const parsed = updatePatientProfileSchema.safeParse({ gender: 'MALE' });
    expect(parsed.success).toBe(true);
  });

  it('updatePatientProfile requires middle name when updating identity fields', () => {
    expect(
      updatePatientProfileSchema.safeParse({
        firstName: 'A',
        lastName: 'B',
      }).success,
    ).toBe(false);
    expect(
      updatePatientProfileSchema.safeParse({
        firstName: 'A',
        middleName: 'M',
        lastName: 'B',
      }).success,
    ).toBe(true);
  });
});
