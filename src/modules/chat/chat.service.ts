import type { Types } from 'mongoose';
import mongoose from 'mongoose';
import type { AppLanguage } from '../translation/translation.types';
import { enrichMessageDoc, enrichMessagesForViewer } from '../../services/translation.service';
import { getUserPreferredLanguage } from '../../shared/language';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { buildMeta, skipForPage } from '../../shared/pagination';
import { ChatRoomModel } from './chat-room.model';
import { MessageModel } from './message.model';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function idOfPopulated(ref: unknown): string | null {
  if (ref == null) return null;
  if (typeof ref === 'string') return ref;
  if (ref instanceof mongoose.Types.ObjectId) return String(ref);
  if (isRecord(ref) && ref._id != null) return String(ref._id);
  return null;
}

function pickOtherParticipant(
  appointment: Record<string, unknown> | null | undefined,
  userId: Types.ObjectId,
): Record<string, unknown> | null {
  if (!appointment) return null;
  const patient = appointment.patient;
  const practitioner = appointment.practitioner;
  const pid = idOfPopulated(patient);
  const prid = idOfPopulated(practitioner);
  const me = String(userId);
  if (pid === me && isRecord(practitioner)) return practitioner as Record<string, unknown>;
  if (prid === me && isRecord(patient)) return patient as Record<string, unknown>;
  if (isRecord(practitioner) && prid !== me) return practitioner as Record<string, unknown>;
  if (isRecord(patient) && pid !== me) return patient as Record<string, unknown>;
  return null;
}

function normalizeUser(u: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!u) return null;
  return {
    _id: u._id,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    profilePhotoUrl: u.profilePhotoUrl,
  };
}

export type ChatRoomSummary = {
  _id: string;
  appointment: Record<string, unknown> | null;
  isLocked: boolean;
  lastMessageAt: Date | null;
  otherParticipant: Record<string, unknown> | null;
  lastMessage: Record<string, unknown> | null;
  unreadCount: number;
};

async function enrichLastMessagePreview(
  lastMessage: Record<string, unknown> | null,
  viewerLanguage: AppLanguage,
): Promise<Record<string, unknown> | null> {
  if (!lastMessage) return null;
  const enriched = await enrichMessageDoc(lastMessage, viewerLanguage);
  return {
    ...lastMessage,
    content: enriched.displayContent ?? lastMessage.content,
    displayContent: enriched.displayContent,
    originalContent: enriched.originalContent,
    isTranslated: enriched.isTranslated,
  };
}

async function buildRoomSummaries(
  rooms: Record<string, unknown>[],
  userId: Types.ObjectId,
  viewerLanguage: AppLanguage,
): Promise<ChatRoomSummary[]> {
  if (rooms.length === 0) return [];
  const roomIds = rooms.map((r) => r._id as Types.ObjectId);

  const lastAgg = await MessageModel.aggregate([
    { $match: { chatRoom: { $in: roomIds } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$chatRoom', doc: { $first: '$$ROOT' } } },
    {
      $lookup: {
        from: 'users',
        let: { sid: '$doc.sender' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$sid'] } } },
          { $project: { firstName: 1, lastName: 1, role: 1, profilePhotoUrl: 1 } },
        ],
        as: 'senderDoc',
      },
    },
    {
      $addFields: {
        'doc.sender': { $arrayElemAt: ['$senderDoc', 0] },
      },
    },
    { $project: { senderDoc: 0 } },
  ]);

  const unreadAgg = await MessageModel.aggregate([
    {
      $match: {
        chatRoom: { $in: roomIds },
        sender: { $ne: userId },
      },
    },
    {
      $addFields: {
        readIds: {
          $map: {
            input: { $ifNull: ['$readBy', []] },
            as: 'rb',
            in: '$$rb.user',
          },
        },
      },
    },
    {
      $match: {
        $expr: { $not: { $in: [userId, '$readIds'] } },
      },
    },
    { $group: { _id: '$chatRoom', c: { $sum: 1 } } },
  ]);

  const lastByRoom = new Map<string, Record<string, unknown>>();
  for (const row of lastAgg) {
    const rid = String(row._id);
    const doc = row.doc as Record<string, unknown> | undefined;
    if (doc) lastByRoom.set(rid, doc);
  }

  const unreadByRoom = new Map<string, number>();
  for (const row of unreadAgg) {
    unreadByRoom.set(String(row._id), row.c as number);
  }

  const enrichedLastMessages = await Promise.all(
    rooms.map(async (room) => {
      const rid = String(room._id);
      const lastRaw = lastByRoom.get(rid) ?? null;
      if (!lastRaw) return { rid, lastMessage: null };
      const base = {
        _id: lastRaw._id,
        content: lastRaw.content,
        messageType: lastRaw.messageType,
        contentLanguage: lastRaw.contentLanguage,
        translations: lastRaw.translations,
        createdAt: lastRaw.createdAt,
        sender: isRecord(lastRaw.sender) ? normalizeUser(lastRaw.sender as Record<string, unknown>) : lastRaw.sender,
      } as Record<string, unknown>;
      const lastMessage = await enrichLastMessagePreview(base, viewerLanguage);
      return { rid, lastMessage };
    }),
  );
  const lastMessageByRoom = new Map(enrichedLastMessages.map((e) => [e.rid, e.lastMessage]));

  return rooms.map((room) => {
    const rid = String(room._id);
    const appt = isRecord(room.appointment) ? (room.appointment as Record<string, unknown>) : null;
    const other = normalizeUser(pickOtherParticipant(appt, userId));
    const lastMessage = lastMessageByRoom.get(rid) ?? null;

    return {
      _id: rid,
      appointment: appt,
      isLocked: Boolean(room.isLocked),
      lastMessageAt: (room.lastMessageAt as Date | undefined) ?? null,
      otherParticipant: other,
      lastMessage,
      unreadCount: unreadByRoom.get(rid) ?? 0,
    };
  });
}

async function assertParticipant(roomId: string, userId: Types.ObjectId) {
  const room = await ChatRoomModel.findById(roomId);
  if (!room) throw new NotFoundError('Chat room not found');
  const ok = room.participants.some((p) => p.equals(userId));
  if (!ok) throw new ForbiddenError();
  return room;
}

export async function listMessages(roomId: string, userId: Types.ObjectId, page: number, limit: number, before?: Date) {
  await assertParticipant(roomId, userId);
  const viewerLanguage = await getUserPreferredLanguage(userId);
  const q: Record<string, unknown> = { chatRoom: roomId };
  if (before) q.createdAt = { $lt: before };
  const total = await MessageModel.countDocuments(q);
  const rows = await MessageModel.find(q)
    .sort({ createdAt: -1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .populate('sender', 'firstName lastName role profilePhotoUrl')
    .lean();
  const items = await enrichMessagesForViewer(rows as Record<string, unknown>[], viewerLanguage);
  return { items, meta: buildMeta(total, page, limit) };
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
  const contentLanguage = await getUserPreferredLanguage(userId);
  const msg = await MessageModel.create({
    chatRoom: roomId,
    sender: userId,
    content: body.content,
    contentLanguage,
    attachments: body.attachments ?? [],
    messageType: body.messageType ?? 'TEXT',
  });
  await ChatRoomModel.updateOne({ _id: roomId }, { lastMessageAt: new Date() });
  const populated = await MessageModel.findById(msg._id)
    .populate({ path: 'sender', select: 'firstName lastName role profilePhotoUrl' })
    .lean();
  if (!populated) throw new NotFoundError('Message not found');
  const viewerLanguage = await getUserPreferredLanguage(userId);
  return enrichMessageDoc(populated as Record<string, unknown>, viewerLanguage);
}

export async function listRoomsForUser(userId: Types.ObjectId, page: number, limit: number) {
  const match = { participants: userId };
  const total = await ChatRoomModel.countDocuments(match);
  const rows = await ChatRoomModel.find(match)
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .populate({
      path: 'appointment',
      select: 'scheduledStart status reasonForVisit patient practitioner chatRoom',
      populate: [
        { path: 'patient', select: 'firstName lastName role profilePhotoUrl' },
        { path: 'practitioner', select: 'firstName lastName role profilePhotoUrl' },
      ],
    })
    .lean();
  const viewerLanguage = await getUserPreferredLanguage(userId);
  const items = await buildRoomSummaries(rows as Record<string, unknown>[], userId, viewerLanguage);
  return { items, meta: buildMeta(total, page, limit) };
}

export async function getRoomForUser(roomId: string, userId: Types.ObjectId): Promise<ChatRoomSummary> {
  await assertParticipant(roomId, userId);
  const row = await ChatRoomModel.findById(roomId)
    .populate({
      path: 'appointment',
      select: 'scheduledStart status reasonForVisit patient practitioner chatRoom',
      populate: [
        { path: 'patient', select: 'firstName lastName role profilePhotoUrl' },
        { path: 'practitioner', select: 'firstName lastName role profilePhotoUrl' },
      ],
    })
    .lean();
  if (!row) throw new NotFoundError('Chat room not found');
  const viewerLanguage = await getUserPreferredLanguage(userId);
  const [summary] = await buildRoomSummaries([row as Record<string, unknown>], userId, viewerLanguage);
  return summary;
}

export async function markRoomReadAll(roomId: string, userId: Types.ObjectId) {
  await assertParticipant(roomId, userId);
  const now = new Date();
  const res = await MessageModel.updateMany(
    {
      chatRoom: roomId,
      sender: { $ne: userId },
      readBy: { $not: { $elemMatch: { user: userId } } },
    },
    { $push: { readBy: { user: userId, readAt: now } } },
  );
  return { marked: res.modifiedCount ?? 0 };
}

export async function createSocketMessage(
  roomId: string,
  userId: Types.ObjectId,
  content: string,
  messageType: string,
  attachments?: { url: string; type?: string; fileName?: string; size?: number; mimeType?: string; duration?: number }[],
) {
  const room = await assertParticipant(roomId, userId);
  if (room.isLocked) throw new ValidationError('Chat is locked');
  const contentLanguage = await getUserPreferredLanguage(userId);
  const msg = await MessageModel.create({
    chatRoom: roomId,
    sender: userId,
    content: content || undefined,
    contentLanguage,
    messageType,
    attachments: attachments ?? [],
  });
  await ChatRoomModel.updateOne({ _id: roomId }, { lastMessageAt: new Date() });
  return msg.toObject();
}
