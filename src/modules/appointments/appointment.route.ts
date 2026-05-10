import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { validateBody, validateParams } from '../../middlewares/validate';
import * as ctrl from './appointment.controller';
import {
  appointmentIdParamSchema,
  bookAppointmentSchema,
  cancelSchema,
  rescheduleSchema,
  practitionerNotesSchema,
} from './appointment.validation';

const router = Router();
router.use(authenticate);

router.post('/', validateBody(bookAppointmentSchema), asyncHandler(ctrl.book));
router.get('/:id', validateParams(appointmentIdParamSchema), asyncHandler(ctrl.getById));
router.post('/:id/confirm', validateParams(appointmentIdParamSchema), asyncHandler(ctrl.confirm));
router.post('/:id/reject', validateParams(appointmentIdParamSchema), asyncHandler(ctrl.reject));
router.post('/:id/start', validateParams(appointmentIdParamSchema), asyncHandler(ctrl.start));
router.post('/:id/complete', validateParams(appointmentIdParamSchema), asyncHandler(ctrl.complete));
router.post('/:id/no-show', validateParams(appointmentIdParamSchema), asyncHandler(ctrl.noShow));
router.post('/:id/cancel', validateParams(appointmentIdParamSchema), validateBody(cancelSchema), asyncHandler(ctrl.cancel));
router.patch(
  '/:id/reschedule',
  validateParams(appointmentIdParamSchema),
  validateBody(rescheduleSchema),
  asyncHandler(ctrl.reschedule),
);
router.patch(
  '/:id/practitioner-notes',
  validateParams(appointmentIdParamSchema),
  validateBody(practitionerNotesSchema),
  asyncHandler(ctrl.practitionerNotes),
);

export const appointmentRouter = router;
