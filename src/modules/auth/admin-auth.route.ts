import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authLoginLimiter } from '../../middlewares/rateLimits';
import { validateBody } from '../../middlewares/validate';
import * as ctrl from './auth.controller';
import { adminLoginSchema } from './auth.validation';

const router = Router();

router.post('/login', authLoginLimiter, validateBody(adminLoginSchema), asyncHandler(ctrl.adminLogin));

export const adminAuthRouter = router;
