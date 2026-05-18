import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { requireRole } from '../../middlewares/requireRole';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate';
import * as ctrl from './prescription.controller';
import { issuePrescriptionSchema, listPrescriptionsQuerySchema, prescriptionIdParamSchema } from './prescription.validation';

const router = Router();
router.use(authenticate);

router.post('/', requireRole('PRACTITIONER'), validateBody(issuePrescriptionSchema), asyncHandler(ctrl.issue));
router.get('/me', requireRole('PATIENT'), validateQuery(listPrescriptionsQuerySchema), asyncHandler(ctrl.listMinePatient));
router.get('/me/practitioner', requireRole('PRACTITIONER'), validateQuery(listPrescriptionsQuerySchema), asyncHandler(ctrl.listMinePractitioner));
router.get('/:id', validateParams(prescriptionIdParamSchema), asyncHandler(ctrl.getById));

export const prescriptionRouter = router;
