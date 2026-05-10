import { domainEvents } from '../events/domain.events';
import { logger } from '../config/logger';
import { UserModel } from '../modules/users/user.model';
import { getEmailAdapter } from '../services/email';

export function registerNotificationSubscribers(): void {
  domainEvents.onTyped('AppointmentConfirmed', async (payload) => {
    logger.info({ payload }, 'AppointmentConfirmed');
    const [patient, practitioner] = await Promise.all([
      UserModel.findById(payload.patientId).lean(),
      UserModel.findById(payload.practitionerId).lean(),
    ]);
    const mail = getEmailAdapter();
    if (patient?.email) {
      await mail.sendMail({
        to: patient.email,
        subject: 'Appointment confirmed',
        html: `<p>Your appointment ${payload.appointmentId} was confirmed.</p>`,
      });
    }
    if (practitioner?.email) {
      await mail.sendMail({
        to: practitioner.email,
        subject: 'Appointment confirmed',
        html: `<p>Appointment ${payload.appointmentId} confirmed.</p>`,
      });
    }
  });

  domainEvents.onTyped('AppointmentCancelled', async (payload) => {
    logger.info({ payload }, 'AppointmentCancelled');
  });

  domainEvents.onTyped('PrescriptionIssued', async (payload) => {
    logger.info({ payload }, 'PrescriptionIssued');
    const patient = await UserModel.findById(payload.patientId).lean();
    if (patient?.email) {
      await getEmailAdapter().sendMail({
        to: patient.email,
        subject: 'Prescription ready',
        html: `<p>Your prescription ${payload.prescriptionId} is ready to view in the app.</p>`,
      });
    }
  });

  domainEvents.onTyped('AdminInvited', async (payload) => {
    logger.info({ email: payload.email }, 'AdminInvited');
  });
}
