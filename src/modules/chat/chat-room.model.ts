import mongoose, { Schema } from 'mongoose';

const chatRoomSchema = new Schema(
  {
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    isLocked: { type: Boolean, default: false },
    lastMessageAt: { type: Date },
  },
  { timestamps: true, collection: 'chat_rooms' },
);

export const ChatRoomModel = mongoose.model('ChatRoom', chatRoomSchema);
