import mongoose, { Schema } from 'mongoose';
import { MESSAGE_TYPES } from '../../config/constants';

const readBySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, required: true },
  },
  { _id: false },
);

const deliveredSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deliveredAt: { type: Date, required: true },
  },
  { _id: false },
);

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    type: { type: String },
    fileName: { type: String },
    size: { type: Number },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    chatRoom: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String },
    attachments: [attachmentSchema],
    messageType: { type: String, enum: MESSAGE_TYPES, default: 'TEXT' },
    readBy: [readBySchema],
    deliveredTo: [deliveredSchema],
    editedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true, collection: 'messages' },
);

messageSchema.index({ chatRoom: 1, createdAt: -1 });

export const MessageModel = mongoose.model('Message', messageSchema);
