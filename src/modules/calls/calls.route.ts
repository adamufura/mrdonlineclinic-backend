import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { validateBody } from '../../middlewares/validate';
import * as ctrl from './calls.controller';
import { callActionSchema, callTokenSchema } from './calls.validation';

const router = Router();
router.use(authenticate);

router.post('/token', validateBody(callTokenSchema), asyncHandler(ctrl.getToken));
router.post('/start', validateBody(callTokenSchema), asyncHandler(ctrl.startCall));
router.post('/end', validateBody(callActionSchema), asyncHandler(ctrl.endCall));
router.post('/reject', validateBody(callActionSchema), asyncHandler(ctrl.rejectCall));

export const callsRouter = router;
