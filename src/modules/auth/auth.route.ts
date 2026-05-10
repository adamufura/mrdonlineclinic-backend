import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import {
  authLoginLimiter,
  authRefreshLimiter,
  passwordResetLimiter,
} from '../../middlewares/rateLimits';
import { validateBody } from '../../middlewares/validate';
import * as ctrl from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerPatientSchema,
  registerPractitionerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.validation';

const router = Router();

router.post('/register/patient', validateBody(registerPatientSchema), asyncHandler(ctrl.registerPatient));
router.post(
  '/register/practitioner',
  validateBody(registerPractitionerSchema),
  asyncHandler(ctrl.registerPractitioner),
);
router.post('/login', authLoginLimiter, validateBody(loginSchema), asyncHandler(ctrl.login));
router.post('/refresh', authRefreshLimiter, validateBody(refreshSchema), asyncHandler(ctrl.refresh));
router.post('/logout', validateBody(logoutSchema), asyncHandler(ctrl.logout));
router.post('/verify-email', validateBody(verifyEmailSchema), asyncHandler(ctrl.verifyEmail));
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(ctrl.forgotPassword),
);
router.post(
  '/reset-password',
  passwordResetLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(ctrl.resetPassword),
);
router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(ctrl.changePassword),
);
router.get('/me', authenticate, asyncHandler(ctrl.me));

export const authRouter = router;
