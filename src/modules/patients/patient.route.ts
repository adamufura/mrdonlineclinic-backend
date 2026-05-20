import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { requirePermission } from '../../middlewares/requirePermission';
import { requireRole } from '../../middlewares/requireRole';
import { requireSuperAdmin } from '../../middlewares/requireSuperAdmin';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate';
import { uploadSingleImage } from '../../middlewares/upload';
import * as ctrl from './patient.controller';
import {
  adminPatientIdParamSchema,
  createPatientAdminSchema,
  listPatientAppointmentsQuerySchema,
  listPatientsAdminQuerySchema,
  updatePatientAdminSchema,
  updatePatientProfileSchema,
  updatePatientAddressSchema,
  updatePatientEmergencySchema,
  updatePatientHealthRecordSchema,
  updatePatientMedicalSchema,
} from './patient.validation';
import { paginationQuerySchema } from '../../shared/pagination';

const router = Router();

router.use(authenticate, requireRole('PATIENT'));

router.get('/me', asyncHandler(ctrl.me));
router.patch('/me', validateBody(updatePatientProfileSchema), asyncHandler(ctrl.patchMe));
router.patch('/me/medical', validateBody(updatePatientMedicalSchema), asyncHandler(ctrl.patchMedical));
router.patch('/me/medical/health-record', validateBody(updatePatientHealthRecordSchema), asyncHandler(ctrl.patchHealthRecord));
router.patch('/me/medical/emergency', validateBody(updatePatientEmergencySchema), asyncHandler(ctrl.patchEmergency));
router.patch('/me/medical/address', validateBody(updatePatientAddressSchema), asyncHandler(ctrl.patchAddress));
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
adminRouter.get('/', requirePermission('patients:read'), validateQuery(listPatientsAdminQuerySchema), asyncHandler(ctrl.adminList));
adminRouter.post('/', requirePermission('patients:write'), validateBody(createPatientAdminSchema), asyncHandler(ctrl.adminCreate));
adminRouter.get('/:id', requirePermission('patients:read'), validateParams(adminPatientIdParamSchema), asyncHandler(ctrl.adminGetById));
adminRouter.patch(
  '/:id',
  requirePermission('patients:write'),
  validateParams(adminPatientIdParamSchema),
  validateBody(updatePatientAdminSchema),
  asyncHandler(ctrl.adminPatch),
);
adminRouter.delete(
  '/:id',
  requireSuperAdmin,
  validateParams(adminPatientIdParamSchema),
  asyncHandler(ctrl.adminRemove),
);

export const patientRouter = router;
export const patientAdminRouter = adminRouter;
