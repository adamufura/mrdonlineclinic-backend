import dayjs from 'dayjs';
import type { Types } from 'mongoose';
import { PRESCRIPTION_VALIDITY_DAYS } from '../../config/clinic';
import { buildPrescriptionPdf, fetchImageBuffer, type PrescriptionPdfInput } from '../../services/pdf/prescription-pdf';
import { AppointmentModel } from '../appointments/appointment.model';
import { SpecialtyModel } from '../specialties/specialty.model';
import { PatientModel, PractitionerModel } from '../users/user.model';

function userDisplayName(u: { firstName?: string; lastName?: string }) {
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
}

/** Short ref from appointment ObjectId (last 8 chars, uppercase). */
function consultationRefFromAppointmentId(id: Types.ObjectId | string): string {
  return String(id).slice(-8).toUpperCase();
}

export async function buildPrescriptionPdfForIssue(input: {
  appointmentId: Types.ObjectId | string;
  patientId: Types.ObjectId;
  practitionerId: Types.ObjectId;
  prescriptionNumber: string;
  issuedAt: Date;
  diagnosis: string;
  medications: PrescriptionPdfInput['medications'];
  additionalNotes?: string;
}): Promise<Buffer> {
  const [patient, practitioner, appointment] = await Promise.all([
    PatientModel.findById(input.patientId).lean(),
    PractitionerModel.findById(input.practitionerId).select('+signatureUrl').lean(),
    AppointmentModel.findById(input.appointmentId).lean(),
  ]);

  if (!patient || !practitioner) {
    throw new Error('Patient or practitioner not found for prescription PDF');
  }

  const specialtyIds = (practitioner.specialties ?? []) as Types.ObjectId[];
  const specialties =
    specialtyIds.length > 0
      ? await SpecialtyModel.find({ _id: { $in: specialtyIds } }).select('name').lean()
      : [];

  let signatureImage: Buffer | null = null;
  const sigUrl = practitioner.signatureUrl as string | undefined;
  if (sigUrl) {
    signatureImage = await fetchImageBuffer(sigUrl);
  }

  const issuedAt = input.issuedAt;
  const validUntil = dayjs(issuedAt).add(PRESCRIPTION_VALIDITY_DAYS, 'day').toDate();

  const pdfInput: PrescriptionPdfInput = {
    prescriptionNumber: input.prescriptionNumber,
    issuedAt,
    validUntil,
    printedAt: new Date(),
    appointmentDate: appointment?.scheduledStart ?? null,
    consultationRef: consultationRefFromAppointmentId(input.appointmentId),
    patient: {
      fullName: userDisplayName(patient as { firstName?: string; lastName?: string }),
      dateOfBirth: (patient as { dateOfBirth?: Date }).dateOfBirth ?? null,
      gender: (patient as { gender?: string }).gender ?? null,
      bloodGroup: (patient as { bloodGroup?: string }).bloodGroup ?? null,
      phone: (patient as { phoneNumber?: string }).phoneNumber ?? null,
      email: (patient as { email?: string }).email ?? null,
    },
    practitioner: {
      fullName: userDisplayName(practitioner as { firstName?: string; lastName?: string }),
      licenseNumber: (practitioner as { licenseNumber?: string }).licenseNumber ?? null,
      specialtyNames: specialties.map((s) => String((s as { name?: string }).name ?? '')).filter(Boolean),
      email: (practitioner as { email?: string }).email ?? null,
      phone: (practitioner as { phoneNumber?: string }).phoneNumber ?? null,
      signatureImage,
    },
    diagnosis: input.diagnosis,
    medications: input.medications,
    additionalNotes: input.additionalNotes ?? null,
  };

  return buildPrescriptionPdf(pdfInput);
}

/**
 * Mock payload — every field mirrors live data from issuePrescription / buildPrescriptionPdfForIssue.
 * Use for: npm run prescription:mock
 */
export function buildMockPrescriptionPdfInput(): PrescriptionPdfInput {
  const issuedAt = new Date('2026-05-20T14:29:00');
  const validUntil = dayjs(issuedAt).add(PRESCRIPTION_VALIDITY_DAYS, 'day').toDate();
  const appointmentDate = new Date('2026-05-18T10:00:00');

  return {
    prescriptionNumber: 'MRD-RX-2026-000042',
    issuedAt,
    validUntil,
    printedAt: new Date('2026-05-20T14:29:00'),
    appointmentDate,
    consultationRef: '3A6F19DAB',
    patient: {
      fullName: 'Adamu Suleiman',
      dateOfBirth: new Date('1990-06-15'),
      gender: 'MALE',
      bloodGroup: 'O_POS',
      phone: '+234 801 234 5678',
      email: 'adamu.suleiman@example.com',
    },
    practitioner: {
      fullName: 'Chukwuemeka Okafor',
      licenseNumber: 'MDCN/PRAC/2018/04521',
      specialtyNames: ['General Practice', 'Telemedicine'],
      email: 'dr.okafor@mrdonline.ng',
      phone: '+234 802 987 6543',
      signatureImage: null,
    },
    diagnosis:
      'Acute upper respiratory tract infection (URTI), mild. No signs of bacterial complication or lower respiratory involvement.',
    medications: [
      {
        drugName: 'Amoxicillin',
        dosage: '500 mg',
        frequency: 'Three times daily',
        duration: '7 days',
        route: 'Oral',
        instructions: 'Take after meals. Complete the full course even if symptoms improve.',
      },
      {
        drugName: 'Paracetamol',
        dosage: '1 g',
        frequency: 'Every 6 hours when required',
        duration: '5 days',
        route: 'Oral',
        instructions: 'Maximum 4 g in 24 hours. Avoid other paracetamol-containing products.',
      },
      {
        drugName: 'Loratadine',
        dosage: '10 mg',
        frequency: 'Once daily',
        duration: '5 days',
        route: 'Oral',
        instructions: 'Prefer evening dose if drowsiness occurs.',
      },
    ],
    additionalNotes:
      'Encourage rest and adequate oral fluids. Patient advised to isolate if fever persists beyond 48 hours. Return for teleconsult review if symptoms worsen, dyspnoea develops, or no improvement by day 5.',
  };
}

export async function buildMockPrescriptionPdfBuffer(): Promise<Buffer> {
  return buildPrescriptionPdf(buildMockPrescriptionPdfInput());
}
