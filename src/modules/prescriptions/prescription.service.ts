import mongoose from 'mongoose';
import type { Types } from 'mongoose';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { buildMeta, skipForPage } from '../../shared/pagination';
import { domainEvents } from '../../events/domain.events';
import { prescriptionFolder, uploadBuffer } from '../../services/imagekit.service';
import { buildPrescriptionPdf } from '../../services/pdf/prescription-pdf';
import { AppointmentModel } from '../appointments/appointment.model';
import { createNotification } from '../notifications/notification.service';
import { refId } from '../appointments/appointment.service';
import { UserModel } from '../users/user.model';
import { CounterModel } from './counter.model';
import { PrescriptionModel } from './prescription.model';

async function nextPrescriptionNumber(session: mongoose.ClientSession | null): Promise<string> {
  const year = new Date().getUTCFullYear();
  const counterId = `prescription_${year}`;
  const counter = await CounterModel.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session: session ?? undefined },
  );
  const seq = counter?.seq ?? 1;
  return `MRD-RX-${year}-${String(seq).padStart(6, '0')}`;
}

function userDisplayName(u: { firstName?: string; lastName?: string }) {
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
}

export async function issuePrescription(
  practitionerId: Types.ObjectId,
  body: {
    appointmentId: string;
    diagnosis: string;
    medications: {
      drugName: string;
      dosage: string;
      frequency: string;
      duration: string;
      route?: string;
      instructions?: string;
    }[];
    additionalNotes?: string;
  },
) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const appointment = await AppointmentModel.findById(body.appointmentId).session(session);
    if (!appointment) {
      await session.abortTransaction();
      throw new NotFoundError('Appointment not found');
    }
    if (!refId(appointment.practitioner).equals(practitionerId)) {
      await session.abortTransaction();
      throw new ForbiddenError();
    }
    if (appointment.status !== 'COMPLETED') {
      await session.abortTransaction();
      throw new ValidationError('Prescription can only be issued for completed appointments');
    }
    const dup = await PrescriptionModel.findOne({ appointment: appointment._id }).session(session);
    if (dup) {
      await session.abortTransaction();
      throw new ConflictError('Prescription already exists for this appointment');
    }

    const prescriptionNumber = await nextPrescriptionNumber(session);
    const issuedAt = new Date();
    const [rx] = await PrescriptionModel.create(
      [
        {
          appointment: appointment._id,
          patient: refId(appointment.patient),
          practitioner: practitionerId,
          diagnosis: body.diagnosis,
          medications: body.medications,
          additionalNotes: body.additionalNotes,
          pdfUrl: '',
          issuedAt,
          prescriptionNumber,
        },
      ],
      { session },
    );

    await AppointmentModel.updateOne({ _id: appointment._id }, { $set: { prescription: rx._id } }, { session });
    await session.commitTransaction();

    const patient = await UserModel.findById(refId(appointment.patient)).lean();
    const practitioner = await UserModel.findById(practitionerId).lean();
    if (!patient || !practitioner) throw new NotFoundError('User not found');

    const pdfBuf = await buildPrescriptionPdf({
      prescriptionNumber,
      patientName: userDisplayName(patient as { firstName?: string; lastName?: string }),
      practitionerName: userDisplayName(practitioner as { firstName?: string; lastName?: string }),
      diagnosis: body.diagnosis,
      medications: body.medications,
      additionalNotes: body.additionalNotes,
      issuedAt,
    });
    const uploaded = await uploadBuffer({
      buffer: pdfBuf,
      fileName: `${prescriptionNumber}.pdf`,
      folder: prescriptionFolder(String(rx._id)),
    });
    await PrescriptionModel.updateOne({ _id: rx._id }, { $set: { pdfUrl: uploaded.url } });

    await createNotification({
      recipient: refId(appointment.patient),
      type: 'PRESCRIPTION_ISSUED',
      title: 'Prescription ready',
      body: `Your prescription ${prescriptionNumber} is available.`,
      data: { prescriptionId: String(rx._id) },
    });

    domainEvents.emitTyped('PrescriptionIssued', {
      prescriptionId: String(rx._id),
      patientId: String(refId(appointment.patient)),
    });

    return { ...rx.toObject(), pdfUrl: uploaded.url };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

export async function listForPatient(patientId: Types.ObjectId, page: number, limit: number) {
  const total = await PrescriptionModel.countDocuments({ patient: patientId });
  const rows = await PrescriptionModel.find({ patient: patientId })
    .sort({ issuedAt: -1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .populate('practitioner', 'firstName lastName')
    .lean();
  return { items: rows, meta: buildMeta(total, page, limit) };
}

export async function getByIdForUser(id: string, userId: Types.ObjectId, role: string) {
  const rx = await PrescriptionModel.findById(id).populate('patient practitioner appointment');
  if (!rx) throw new NotFoundError('Prescription not found');
  if (role === 'ADMIN') return rx.toObject();
  if (refId(rx.patient).equals(userId) || refId(rx.practitioner).equals(userId)) return rx.toObject();
  throw new ForbiddenError();
}
