import type { Types } from 'mongoose';
import { NOTIFICATION_TYPES } from '../../config/constants';
import { NotificationModel } from './notification.model';

type NotifType = (typeof NOTIFICATION_TYPES)[number];

export async function createNotification(input: {
  recipient: Types.ObjectId;
  type: NotifType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  return NotificationModel.create(input);
}
