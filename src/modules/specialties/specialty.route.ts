import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { requireRole } from '../../middlewares/requireRole';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate';
import * as ctrl from './specialty.controller';
import {
  createSpecialtySchema,
  listSpecialtiesAdminQuerySchema,
  specialtyIdParamSchema,
  updateSpecialtySchema,
} from './specialty.validation';

export const specialtyPublicRouter = Router();
specialtyPublicRouter.get('/', asyncHandler(ctrl.listPublic));

export const specialtyAdminRouter = Router();
specialtyAdminRouter.use(authenticate, requireRole('ADMIN'));
specialtyAdminRouter.get('/', validateQuery(listSpecialtiesAdminQuerySchema), asyncHandler(ctrl.listAdmin));
specialtyAdminRouter.post('/', validateBody(createSpecialtySchema), asyncHandler(ctrl.create));
specialtyAdminRouter.patch(
  '/:id',
  validateParams(specialtyIdParamSchema),
  validateBody(updateSpecialtySchema),
  asyncHandler(ctrl.update),
);
specialtyAdminRouter.delete('/:id', validateParams(specialtyIdParamSchema), asyncHandler(ctrl.remove));
