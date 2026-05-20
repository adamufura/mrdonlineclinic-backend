import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { requirePermission } from '../../middlewares/requirePermission';
import { requireRole } from '../../middlewares/requireRole';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate';
import { uploadSingleFile, uploadSingleImage } from '../../middlewares/upload';
import * as ctrl from './practitioner.controller';
import { paginationQuerySchema } from '../../shared/pagination';
import { listAppointmentsQuerySchema } from '../appointments/appointment.validation';
import {
  blockRangeSchema,
  createRecurringSchema,
  createSlotSchema,
  listPractitionersQuerySchema,
  listSlotsQuerySchema,
  materializeQuerySchema,
  practitionerIdParamSchema,
  publicSlotsQuerySchema,
  createPractitionerAdminSchema,
  rejectPractitionerSchema,
  slotIdParamSchema,
  updatePractitionerAdminSchema,
  updatePractitionerProfileSchema,
  verifyPractitionerSchema,
} from './practitioner.validation';

const router = Router();

const me = Router();
me.use(authenticate, requireRole('PRACTITIONER'));
me.get('/', asyncHandler(ctrl.me));
me.patch('/', validateBody(updatePractitionerProfileSchema), asyncHandler(ctrl.patchMe));
me.post('/credentials', (req, res, next) => {
  uploadSingleFile(req, res, (err) => (err ? next(err) : next()));
}, asyncHandler(ctrl.postCredentials));
me.post('/photo', (req, res, next) => {
  uploadSingleImage(req, res, (err) => (err ? next(err) : next()));
}, asyncHandler(ctrl.postPhoto));
me.post('/signature', (req, res, next) => {
  uploadSingleImage(req, res, (err) => (err ? next(err) : next()));
}, asyncHandler(ctrl.postSignature));
me.get('/patients', asyncHandler(ctrl.myPatients));
me.get('/slots', validateQuery(listSlotsQuerySchema), asyncHandler(ctrl.mySlots));
me.post('/slots', validateBody(createSlotSchema), asyncHandler(ctrl.createSlot));
me.delete('/slots/:slotId', validateParams(slotIdParamSchema), asyncHandler(ctrl.deleteSlot));
me.post('/slots/recurring', validateBody(createRecurringSchema), asyncHandler(ctrl.createRecurring));
me.post('/slots/materialize', validateQuery(materializeQuerySchema), asyncHandler(ctrl.materialize));
me.post('/slots/block', validateBody(blockRangeSchema), asyncHandler(ctrl.blockRange));
me.get('/appointments', validateQuery(listAppointmentsQuerySchema), asyncHandler(ctrl.myAppointments));

router.use('/me', me);

router.get('/', validateQuery(listPractitionersQuerySchema), asyncHandler(ctrl.listDirectory));
router.get('/:id/slots', validateParams(practitionerIdParamSchema), validateQuery(publicSlotsQuerySchema), asyncHandler(ctrl.publicSlots));
router.get('/:id', validateParams(practitionerIdParamSchema), asyncHandler(ctrl.publicProfile));

const adminRouter = Router();
adminRouter.use(authenticate, requireRole('ADMIN'));
adminRouter.get('/', requirePermission('practitioners:read'), validateQuery(paginationQuerySchema), asyncHandler(ctrl.adminList));
adminRouter.post('/', requirePermission('practitioners:onboard'), validateBody(createPractitionerAdminSchema), asyncHandler(ctrl.adminCreate));
adminRouter.get('/:id', requirePermission('practitioners:read'), validateParams(practitionerIdParamSchema), asyncHandler(ctrl.adminGet));
adminRouter.patch(
  '/:id',
  requirePermission('practitioners:write'),
  validateParams(practitionerIdParamSchema),
  validateBody(updatePractitionerAdminSchema),
  asyncHandler(ctrl.adminPatch),
);
adminRouter.post(
  '/:id/credentials',
  requirePermission('practitioners:write'),
  validateParams(practitionerIdParamSchema),
  (req, res, next) => {
    uploadSingleFile(req, res, (err) => (err ? next(err) : next()));
  },
  asyncHandler(ctrl.adminUploadCredentials),
);
adminRouter.post(
  '/:id/reset-password',
  requirePermission('practitioners:write'),
  validateParams(practitionerIdParamSchema),
  asyncHandler(ctrl.adminResetPassword),
);
adminRouter.post(
  '/:id/verify',
  requirePermission('practitioners:verify'),
  validateParams(practitionerIdParamSchema),
  validateBody(verifyPractitionerSchema),
  asyncHandler(ctrl.adminVerify),
);
adminRouter.post(
  '/:id/reject',
  requirePermission('practitioners:verify'),
  validateParams(practitionerIdParamSchema),
  validateBody(rejectPractitionerSchema),
  asyncHandler(ctrl.adminReject),
);
adminRouter.post(
  '/:id/suspend',
  requirePermission('practitioners:write'),
  validateParams(practitionerIdParamSchema),
  asyncHandler(ctrl.adminSuspend),
);

export const practitionerRouter = router;
export const practitionerAdminRouter = adminRouter;
