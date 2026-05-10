import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { validateParams, validateQuery } from '../../middlewares/validate';
import * as ctrl from './notification.controller';
import { listNotificationsQuerySchema, notificationIdParamSchema } from './notification.validation';

const router = Router();
router.use(authenticate);

router.get('/', validateQuery(listNotificationsQuerySchema), asyncHandler(ctrl.list));
router.patch('/:id/read', validateParams(notificationIdParamSchema), asyncHandler(ctrl.markRead));
router.post('/read-all', asyncHandler(ctrl.markAllRead));

export const notificationRouter = router;
