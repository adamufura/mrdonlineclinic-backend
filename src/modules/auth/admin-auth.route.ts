import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authLoginLimiter, passwordResetLimiter } from '../../middlewares/rateLimits';
import { validateBody } from '../../middlewares/validate';
import * as ctrl from './auth.controller';
import { acceptAdminInviteSchema, adminLoginSchema } from './auth.validation';

const router = Router();

router.post('/login', authLoginLimiter, validateBody(adminLoginSchema), asyncHandler(ctrl.adminLogin));
router.post(
  '/accept-invite',
  passwordResetLimiter,
  validateBody(acceptAdminInviteSchema),
  asyncHandler(ctrl.acceptAdminInvite),
);

export const adminAuthRouter = router;
