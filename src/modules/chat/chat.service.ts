import type { Types } from 'mongoose';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { buildMeta, skipForPage } from '../../shared/pagination';
import { ChatRoomModel } from './chat-room.model';
import { MessageModel } from './message.model';

async function assertParticipant(roomId: string, userId: Types.ObjectId) {
  const room = await ChatRoomModel.findById(roomId);
  if (!room) throw new NotFoundError('Chat room not found');
  const ok = room.participants.some((p) => p.equals(userId));
  if (!ok) throw new ForbiddenError();
  return room;
}

export async function listMessages(roomId: string, userId: Types.ObjectId, page: number, limit: number, before?: Date) {
  await assertParticipant(roomId, userId);
  const q: Record<string, unknown> = { chatRoom: roomId };
  if (before) q.createdAt = { $lt: before };
  const total = await MessageModel.countDocuments(q);
  const rows = await MessageModel.find(q)
    .sort({ createdAt: -1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .populate('sender', 'firstName lastName role profilePhotoUrl')
    .lean();
  return { items: rows, meta: buildMeta(total, page, limit) };
}

export async function markRead(roomId: string, messageId: string, userId: Types.ObjectId) {
  const room = await assertParticipant(roomId, userId);
  const msg = await MessageModel.findOne({ _id: messageId, chatRoom: roomId });
  if (!msg) throw new NotFoundError('Message not found');
  const already = msg.readBy.some((r) => String(r.user) === String(userId));
  if (!already) {
    msg.readBy.push({ user: userId, readAt: new Date() });
    await msg.save();
  }
  await ChatRoomModel.updateOne({ _id: room._id }, { lastMessageAt: new Date() });
  return { message: 'Marked read' };
}

export async function createHttpMessage(
  roomId: string,
  userId: Types.ObjectId,
  body: { content?: string; attachments?: { url: string; type?: string; fileName?: string; size?: number }[]; messageType?: string },
) {
  const room = await assertParticipant(roomId, userId);
  if (room.isLocked) throw new ValidationError('Chat is locked');
  if (!body.content && (!body.attachments || body.attachments.length === 0)) {
    throw new ValidationError('Message must have content or attachments');
  }
  const msg = await MessageModel.create({
    chatRoom: roomId,
    sender: userId,
    content: body.content,
    attachments: body.attachments ?? [],
    messageType: body.messageType ?? 'TEXT',
  });
  await ChatRoomModel.updateOne({ _id: roomId }, { lastMessageAt: new Date() });
  return msg.toObject();
}

export async function createSocketMessage(roomId: string, userId: Types.ObjectId, content: string, messageType: string) {
  const room = await assertParticipant(roomId, userId);
  if (room.isLocked) throw new ValidationError('Chat is locked');
  const msg = await MessageModel.create({
    chatRoom: roomId,
    sender: userId,
    content,
    messageType,
  });
  await ChatRoomModel.updateOne({ _id: roomId }, { lastMessageAt: new Date() });
  return msg.toObject();
}
