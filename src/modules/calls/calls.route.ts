import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { validateBody } from '../../middlewares/validate';
import * as ctrl from './calls.controller';
import { callActionSchema, callEndSchema, callRejectSchema, callTokenSchema } from './calls.validation';

const router = Router();
router.use(authenticate);

router.post('/token', validateBody(callTokenSchema), asyncHandler(ctrl.getToken));
router.post('/start', validateBody(callTokenSchema), asyncHandler(ctrl.startCall));
router.post('/accept', validateBody(callActionSchema), asyncHandler(ctrl.acceptCall));
router.post('/end', validateBody(callEndSchema), asyncHandler(ctrl.endCall));
router.post('/reject', validateBody(callRejectSchema), asyncHandler(ctrl.rejectCall));

export const callsRouter = router;
