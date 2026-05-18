import { RtcTokenBuilder, RtcRole } from 'agora-token';
import type { Types } from 'mongoose';
import { getEnv } from '../../config/env';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { AppointmentModel } from '../appointments/appointment.model';
import { refId } from '../appointments/appointment.service';
import { UserModel } from '../users/user.model';

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
