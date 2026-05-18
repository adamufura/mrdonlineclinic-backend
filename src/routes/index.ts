import type { Express } from 'express';
import { adminAuthRouter } from '../modules/auth/admin-auth.route';
import { authRouter } from '../modules/auth/auth.route';
import { adminRouter } from '../modules/admins/admin.route';
import { appointmentRouter } from '../modules/appointments/appointment.route';
import { callsRouter } from '../modules/calls/calls.route';
import { chatRouter } from '../modules/chat/chat.route';
import { notificationRouter } from '../modules/notifications/notification.route';
import { patientAdminRouter, patientRouter } from '../modules/patients/patient.route';
import { prescriptionRouter } from '../modules/prescriptions/prescription.route';
import { practitionerAdminRouter, practitionerRouter } from '../modules/practitioners/practitioner.route';
import { reviewRouter } from '../modules/reviews/review.route';
import { specialtyAdminRouter, specialtyPublicRouter } from '../modules/specialties/specialty.route';

export function registerRoutes(app: Express, apiPrefix: string) {
  app.use(`${apiPrefix}/auth`, authRouter);
  app.use(`${apiPrefix}/admin/auth`, adminAuthRouter);
  app.use(`${apiPrefix}/specialties`, specialtyPublicRouter);
  app.use(`${apiPrefix}/admin/specialties`, specialtyAdminRouter);
  app.use(`${apiPrefix}/patients`, patientRouter);
  app.use(`${apiPrefix}/admin/patients`, patientAdminRouter);
  app.use(`${apiPrefix}/practitioners`, practitionerRouter);
  app.use(`${apiPrefix}/admin/practitioners`, practitionerAdminRouter);
  app.use(`${apiPrefix}/appointments`, appointmentRouter);
  app.use(`${apiPrefix}/calls`, callsRouter);
  app.use(`${apiPrefix}/chat`, chatRouter);
  app.use(`${apiPrefix}/prescriptions`, prescriptionRouter);
  app.use(`${apiPrefix}/reviews`, reviewRouter);
  app.use(`${apiPrefix}/notifications`, notificationRouter);
  app.use(`${apiPrefix}/admin`, adminRouter);
}
