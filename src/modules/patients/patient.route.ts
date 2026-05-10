import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { requireRole } from '../../middlewares/requireRole';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate';
import { uploadSingleImage } from '../../middlewares/upload';
import * as ctrl from './patient.controller';
import {
  adminPatientIdParamSchema,
  listPatientAppointmentsQuerySchema,
  listPatientsAdminQuerySchema,
  updatePatientMedicalSchema,
  updatePatientProfileSchema,
} from './patient.validation';
import { paginationQuerySchema } from '../../shared/pagination';

const router = Router();

router.use(authenticate, requireRole('PATIENT'));

router.get('/me', asyncHandler(ctrl.me));
router.patch('/me', validateBody(updatePatientProfileSchema), asyncHandler(ctrl.patchMe));
router.patch('/me/medical', validateBody(updatePatientMedicalSchema), asyncHandler(ctrl.patchMedical));
router.post('/me/photo', (req, res, next) => {
  uploadSingleImage(req, res, (err) => {
    if (err) return next(err);
    return next();
  });
}, asyncHandler(ctrl.postPhoto));
router.get('/me/appointments', validateQuery(listPatientAppointmentsQuerySchema), asyncHandler(ctrl.myAppointments));
router.get('/me/prescriptions', validateQuery(paginationQuerySchema), asyncHandler(ctrl.myPrescriptions));

const adminRouter = Router();
adminRouter.use(authenticate, requireRole('ADMIN'));
adminRouter.get('/', validateQuery(listPatientsAdminQuerySchema), asyncHandler(ctrl.adminList));
adminRouter.get('/:id', validateParams(adminPatientIdParamSchema), asyncHandler(ctrl.adminGetById));

export const patientRouter = router;
export const patientAdminRouter = adminRouter;
