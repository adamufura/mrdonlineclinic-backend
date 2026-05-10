import { Router } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { authenticate } from '../../middlewares/authenticate';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate';
import * as ctrl from './chat.controller';
import {
  listMessagesQuerySchema,
  messageIdParamSchema,
  postMessageHttpSchema,
  roomIdParamSchema,
} from './chat.validation';

const router = Router();
router.use(authenticate);

router.get('/rooms/:roomId/messages', validateParams(roomIdParamSchema), validateQuery(listMessagesQuerySchema), asyncHandler(ctrl.listMessages));
router.post(
  '/rooms/:roomId/messages',
  validateParams(roomIdParamSchema),
  validateBody(postMessageHttpSchema),
  asyncHandler(ctrl.postMessage),
);
router.post(
  '/rooms/:roomId/messages/:messageId/read',
  validateParams(messageIdParamSchema),
  asyncHandler(ctrl.markRead),
);

export const chatRouter = router;
