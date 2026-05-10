import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { requireRole } from '../../middlewares/requireRole';
import { validateBody, validateParams } from '../../middlewares/validate';
import * as ctrl from './review.controller';
import { createReviewSchema, hideReviewSchema, reviewIdParamSchema } from './review.validation';

const router = Router();
router.use(authenticate);

router.post('/', requireRole('PATIENT'), validateBody(createReviewSchema), asyncHandler(ctrl.create));

const admin = Router();
admin.use(requireRole('ADMIN'));
admin.patch('/:id/visibility', validateParams(reviewIdParamSchema), validateBody(hideReviewSchema), asyncHandler(ctrl.hide));

router.use('/admin', admin);

export const reviewRouter = router;
