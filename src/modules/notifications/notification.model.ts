import mongoose, { Schema } from 'mongoose';
import { NOTIFICATION_TYPES } from '../../config/constants';

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'notifications' },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

export const NotificationModel = mongoose.model('Notification', notificationSchema);
