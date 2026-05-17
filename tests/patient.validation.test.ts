import {
  updatePatientAddressSchema,
  updatePatientEmergencySchema,
  updatePatientHealthRecordSchema,
  updatePatientProfileSchema,
} from '../src/modules/patients/patient.validation';

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

  it('updatePatientHealthRecord requires all three arrays', () => {
    expect(
      updatePatientHealthRecordSchema.safeParse({
        allergies: ['Penicillin'],
        chronicConditions: [],
        currentMedications: [],
      }).success,
    ).toBe(true);
  });

  it('updatePatientEmergency accepts contact or null', () => {
    expect(
      updatePatientEmergencySchema.safeParse({
        emergencyContact: {
          name: 'Ada',
          relationship: 'Sister',
          phoneNumber: '+2348012345678',
        },
      }).success,
    ).toBe(true);
    expect(updatePatientEmergencySchema.safeParse({ emergencyContact: null }).success).toBe(true);
  });

  it('updatePatientAddress accepts address or null', () => {
    expect(
      updatePatientAddressSchema.safeParse({
        address: { city: 'Abuja', country: 'Nigeria' },
      }).success,
    ).toBe(true);
    expect(updatePatientAddressSchema.safeParse({ address: null }).success).toBe(true);
  });
});
