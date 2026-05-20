import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { requireMinistryStaffManager } from '../../middlewares/requireMinistryStaffManager';
import { requirePermission } from '../../middlewares/requirePermission';
import { requireRole } from '../../middlewares/requireRole';
import { requireSuperAdmin } from '../../middlewares/requireSuperAdmin';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate';
import * as ctrl from './admin.controller';
import {
  adminIdParamSchema,
  auditLogQuerySchema,
  changeAdminRoleSchema,
  createAdminSchema,
  globalSearchQuerySchema,
  listAdminsQuerySchema,
  updateAdminSchema,
} from './admin.validation';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

router.get('/stats', requirePermission('stats:read'), asyncHandler(ctrl.stats));
router.get('/search', requirePermission('stats:read'), validateQuery(globalSearchQuerySchema), asyncHandler(ctrl.search));
router.get('/audit-logs', requirePermission('audit:read'), validateQuery(auditLogQuerySchema), asyncHandler(ctrl.auditLogs));

router.post('/users', requireMinistryStaffManager, validateBody(createAdminSchema), asyncHandler(ctrl.create));
router.get('/users', requirePermission('admins:read'), validateQuery(listAdminsQuerySchema), asyncHandler(ctrl.list));
router.get('/users/:id', requirePermission('admins:read'), validateParams(adminIdParamSchema), asyncHandler(ctrl.getById));
router.patch(
  '/users/:id',
  requireMinistryStaffManager,
  validateParams(adminIdParamSchema),
  validateBody(updateAdminSchema),
  asyncHandler(ctrl.update),
);
router.post(
  '/users/:id/deactivate',
  requireMinistryStaffManager,
  validateParams(adminIdParamSchema),
  asyncHandler(ctrl.deactivate),
);
router.post(
  '/users/:id/reset-password',
  requireMinistryStaffManager,
  validateParams(adminIdParamSchema),
  asyncHandler(ctrl.resetPassword),
);
router.delete('/users/:id', requireSuperAdmin, validateParams(adminIdParamSchema), asyncHandler(ctrl.remove));
router.patch(
  '/users/:id/role',
  requireSuperAdmin,
  validateParams(adminIdParamSchema),
  validateBody(changeAdminRoleSchema),
  asyncHandler(ctrl.changeRole),
);

export const adminRouter = router;
