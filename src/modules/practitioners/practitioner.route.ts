import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
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
  rejectPractitionerSchema,
  slotIdParamSchema,
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
adminRouter.get('/', validateQuery(paginationQuerySchema), asyncHandler(ctrl.adminList));
adminRouter.get('/:id', validateParams(practitionerIdParamSchema), asyncHandler(ctrl.adminGet));
adminRouter.post(
  '/:id/verify',
  validateParams(practitionerIdParamSchema),
  validateBody(verifyPractitionerSchema),
  asyncHandler(ctrl.adminVerify),
);
adminRouter.post(
  '/:id/reject',
  validateParams(practitionerIdParamSchema),
  validateBody(rejectPractitionerSchema),
  asyncHandler(ctrl.adminReject),
);
adminRouter.post('/:id/suspend', validateParams(practitionerIdParamSchema), asyncHandler(ctrl.adminSuspend));

export const practitionerRouter = router;
export const practitionerAdminRouter = adminRouter;
