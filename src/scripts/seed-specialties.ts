/**
 * Upserts a fixed set of common clinical specialties (idempotent by slug).
 * Usage: npm run seed:specialties
 */
import '../config/env';
import { connectDb, disconnectDb } from '../config/db';
import { logger } from '../config/logger';
import { SpecialtyModel } from '../modules/specialties/specialty.model';

const SPECIALTIES: Array<{ name: string; slug: string; description: string }> = [
  {
    name: 'Family Medicine',
    slug: 'family-medicine',
    description:
      'Primary care for all ages: preventive visits, chronic disease follow-up, and common acute concerns via telehealth.',
  },
  {
    name: 'Internal Medicine',
    slug: 'internal-medicine',
    description:
      'Adult medicine for complex or multi-system conditions, medication reconciliation, and chronic disease management.',
  },
  {
    name: 'Pediatrics',
    slug: 'pediatrics',
    description:
      'Care for infants through adolescents: fevers, rashes, minor injuries, feeding and development questions.',
  },
  {
    name: 'Dermatology',
    slug: 'dermatology',
    description:
      'Skin, hair, and nail disorders; photo-based assessment of rashes, acne, eczema, and suspicious lesions.',
  },
  {
    name: 'Psychiatry',
    slug: 'psychiatry',
    description:
      'Mental health evaluation and treatment planning, including mood, anxiety, and attention-related conditions.',
  },
  {
    name: 'Obstetrics & Gynecology',
    slug: 'obstetrics-gynecology',
    description:
      "Women's health: contraception, menstrual disorders, pregnancy-related questions, and routine gynecologic follow-up.",
  },
  {
    name: 'Cardiology',
    slug: 'cardiology',
    description:
      'Heart and vascular care: hypertension, palpitations, lipid management, and follow-up after known cardiac diagnoses.',
  },
  {
    name: 'Endocrinology',
    slug: 'endocrinology',
    description:
      'Hormonal and metabolic conditions such as diabetes, thyroid disorders, and polycystic ovary syndrome.',
  },
  {
    name: 'Orthopedics',
    slug: 'orthopedics',
    description:
      'Musculoskeletal complaints: joint and back pain, strains, overuse injuries, and post-injury recovery guidance.',
  },
  {
    name: 'Gastroenterology',
    slug: 'gastroenterology',
    description:
      'Digestive health: reflux, IBS-type symptoms, abdominal pain, and chronic liver or bowel disease follow-up.',
  },
];

async function main() {
  await connectDb();

  let created = 0;
  let updated = 0;

  for (const row of SPECIALTIES) {
    const filter = { $or: [{ slug: row.slug }, { name: row.name }] };
    const existing = await SpecialtyModel.findOne(filter).lean();
    await SpecialtyModel.findOneAndUpdate(
      filter,
      {
        $set: {
          name: row.name,
          slug: row.slug,
          description: row.description,
          isActive: true,
        },
      },
      { upsert: true, new: true },
    );
    if (existing) updated += 1;
    else created += 1;
  }

  logger.info({ created, updated, total: SPECIALTIES.length }, 'Specialties seed complete');
  await disconnectDb();
}

main().catch((err) => {
  logger.error({ err }, 'seed-specialties failed');
  process.exit(1);
});
