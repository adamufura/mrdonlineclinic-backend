import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { requireRole } from '../../middlewares/requireRole';
import { requireSuperAdmin } from '../../middlewares/requireSuperAdmin';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate';
import { paginationQuerySchema } from '../../shared/pagination';
import * as ctrl from './admin.controller';
import { adminIdParamSchema, auditLogQuerySchema, changeAdminRoleSchema, inviteAdminSchema } from './admin.validation';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

router.get('/stats', asyncHandler(ctrl.stats));
router.get('/audit-logs', validateQuery(auditLogQuerySchema), asyncHandler(ctrl.auditLogs));

router.post('/invite', requireSuperAdmin, validateBody(inviteAdminSchema), asyncHandler(ctrl.invite));
router.get('/users', requireSuperAdmin, validateQuery(paginationQuerySchema), asyncHandler(ctrl.list));
router.post('/users/:id/deactivate', requireSuperAdmin, validateParams(adminIdParamSchema), asyncHandler(ctrl.deactivate));
router.delete('/users/:id', requireSuperAdmin, validateParams(adminIdParamSchema), asyncHandler(ctrl.remove));
router.patch(
  '/users/:id/role',
  requireSuperAdmin,
  validateParams(adminIdParamSchema),
  validateBody(changeAdminRoleSchema),
  asyncHandler(ctrl.changeRole),
);

export const adminRouter = router;
