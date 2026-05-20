import { RtcTokenBuilder, RtcRole } from 'agora-token';
import type { Server } from 'socket.io';
import type { Types } from 'mongoose';
import { CALL_OUTCOMES } from '../../config/constants';
import { getEnv } from '../../config/env';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { emitToUser } from '../../sockets/user-room';
import { AppointmentModel } from '../appointments/appointment.model';
import { refId } from '../appointments/appointment.service';
import { ChatRoomModel } from '../chat/chat-room.model';
import { MessageModel } from '../chat/message.model';
import { UserModel } from '../users/user.model';

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export type CallLogPayload = {
  callType: 'audio' | 'video';
  outcome: CallOutcome;
  durationSeconds?: number;
  initiatorId: string;
};

/** Convert last 8 hex chars of MongoDB ObjectId to a numeric UID for Agora. */
export function userIdToUid(userId: string): number {
  return parseInt(userId.slice(-8), 16);
}

export async function generateCallToken(
  userId: Types.ObjectId,
  body: { appointmentId: string; callType: 'audio' | 'video' },
) {
  const env = getEnv();
  if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE) {
    throw new ValidationError('Video calling is not configured');
  }

  const appointment = await AppointmentModel.findById(body.appointmentId);
  if (!appointment) throw new NotFoundError('Appointment not found');

  const patientId = refId(appointment.patient);
  const practitionerId = refId(appointment.practitioner);
  const isPatient = patientId.equals(userId);
  const isPractitioner = practitionerId.equals(userId);
  if (!isPatient && !isPractitioner) throw new ForbiddenError();

  if (!['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status)) {
    throw new ValidationError('Calls are only available for confirmed or in-progress appointments');
  }

  const channelName = body.appointmentId;
  const uid = userIdToUid(String(userId));
  const expireTime = 3600; // 1 hour
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  const token = RtcTokenBuilder.buildTokenWithUid(
    env.AGORA_APP_ID,
    env.AGORA_APP_CERTIFICATE,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expireTime,
    privilegeExpireTime,
  );

  return {
    token,
    channelName,
    uid,
    appId: env.AGORA_APP_ID,
    callType: body.callType,
  };
}

export async function getCallParticipants(userId: Types.ObjectId, appointmentId: string) {
  const appointment = await AppointmentModel.findById(appointmentId);
  if (!appointment) throw new NotFoundError('Appointment not found');

  const patientId = refId(appointment.patient);
  const practitionerId = refId(appointment.practitioner);
  const isPatient = patientId.equals(userId);
  const isPractitioner = practitionerId.equals(userId);
  if (!isPatient && !isPractitioner) throw new ForbiddenError();

  const otherId = isPatient ? practitionerId : patientId;
  const caller = await UserModel.findById(userId).select('firstName lastName profilePhotoUrl').lean();
  const callee = await UserModel.findById(otherId).select('firstName lastName profilePhotoUrl').lean();

  return {
    callerId: String(userId),
    calleeId: String(otherId),
    callerName: caller ? `${caller.firstName ?? ''} ${caller.lastName ?? ''}`.trim() : 'User',
    callerPhoto: (caller as Record<string, unknown>)?.profilePhotoUrl as string | undefined,
    calleeName: callee ? `${callee.firstName ?? ''} ${callee.lastName ?? ''}`.trim() : 'User',
    calleePhoto: (callee as Record<string, unknown>)?.profilePhotoUrl as string | undefined,
  };
}

function formatCallDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatCallLogContent(payload: CallLogPayload): string {
  const typeLabel = payload.callType === 'video' ? 'Video call' : 'Voice call';
  switch (payload.outcome) {
    case 'completed':
      return payload.durationSeconds != null && payload.durationSeconds > 0
        ? `${typeLabel} · ${formatCallDuration(payload.durationSeconds)}`
        : typeLabel;
    case 'missed':
      return `Missed ${typeLabel.toLowerCase()}`;
    case 'rejected':
      return `Declined ${typeLabel.toLowerCase()}`;
    case 'cancelled':
      return `Cancelled ${typeLabel.toLowerCase()}`;
    default:
      return typeLabel;
  }
}

/** Persist a WhatsApp-style call log row in the appointment chat thread. */
export async function createCallLogMessage(
  appointmentId: string,
  initiatorId: Types.ObjectId,
  payload: Omit<CallLogPayload, 'initiatorId'>,
  io?: Server,
) {
  const room = await ChatRoomModel.findOne({ appointment: appointmentId });
  if (!room) return null;

  const log: CallLogPayload = { ...payload, initiatorId: String(initiatorId) };
  const content = formatCallLogContent(log);
  const msg = await MessageModel.create({
    chatRoom: room._id,
    sender: initiatorId,
    content,
    messageType: 'CALL',
    attachments: [{ type: 'call', url: JSON.stringify(log) }],
  });
  await ChatRoomModel.updateOne({ _id: room._id }, { lastMessageAt: new Date() });

  const populated = await MessageModel.findById(msg._id)
    .populate({ path: 'sender', select: 'firstName lastName role profilePhotoUrl' })
    .lean();

  if (io && populated) {
    io.of('/chat').to(String(room._id)).emit('message', populated);
  }

  return populated;
}

export function notifyIncomingCall(
  io: Server,
  calleeId: string,
  data: {
    appointmentId: string;
    callType: 'audio' | 'video';
    callerId: string;
    callerName: string;
    callerPhoto?: string;
    channelName: string;
  },
) {
  emitToUser(io, calleeId, 'incomingCall', data);
}

export function notifyCallEnded(io: Server, userId: string, data: { appointmentId: string }) {
  emitToUser(io, userId, 'callEnded', data);
}

export function notifyCallRejected(io: Server, userId: string, data: { appointmentId: string }) {
  emitToUser(io, userId, 'callRejected', data);
}

export function notifyCallAccepted(io: Server, userId: string, data: { appointmentId: string }) {
  emitToUser(io, userId, 'callAccepted', data);
}
