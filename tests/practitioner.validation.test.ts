import {
  listPractitionersQuerySchema,
  updatePractitionerProfileSchema,
} from '../src/modules/practitioners/practitioner.validation';

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

  it('listPractitionersQuerySchema treats empty strings as undefined for optional filters', () => {
    const parsed = listPractitionersQuerySchema.parse({
      page: '1',
      limit: '12',
      specialtyId: '',
      search: '',
      location: '',
      date: '',
      sort: 'rating',
    });
    expect(parsed.specialtyId).toBeUndefined();
    expect(parsed.search).toBeUndefined();
    expect(parsed.location).toBeUndefined();
    expect(parsed.date).toBeUndefined();
    expect(parsed.sort).toBe('rating');
  });

  it('listPractitionersQuerySchema accepts date and location', () => {
    const parsed = listPractitionersQuerySchema.parse({
      page: 1,
      limit: 20,
      location: 'Lagos',
      date: '2026-06-01',
      sort: 'experience',
    });
    expect(parsed.location).toBe('Lagos');
    expect(parsed.date).toBe('2026-06-01');
    expect(parsed.sort).toBe('experience');
  });
});
