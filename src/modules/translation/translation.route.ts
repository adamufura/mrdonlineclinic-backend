import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { validateBody } from '../../middlewares/validate';
import * as ctrl from './translation.controller';
import { translateBatchBodySchema, translateBodySchema } from './translation.validation';

const router = Router();

router.use(authenticate);

router.post('/', validateBody(translateBodySchema), asyncHandler(ctrl.translate));
router.post('/batch', validateBody(translateBatchBodySchema), asyncHandler(ctrl.translateBatchHandler));

export const translationRouter = router;
