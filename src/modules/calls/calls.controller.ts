import type { Request, Response } from 'express';
import type { Server } from 'socket.io';
import { AuthError } from '../../shared/errors';
import { ok } from '../../shared/envelope';
import * as svc from './calls.service';

export async function getToken(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const data = await svc.generateCallToken(req.user.id, req.body);
  return res.json(ok('Call token generated', data));
}

export async function startCall(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { appointmentId, callType } = req.body;
  const participants = await svc.getCallParticipants(req.user.id, appointmentId);

  const io = req.app.locals.io as Server | undefined;
  if (io) {
    io.of('/chat').emit('incomingCall', {
      appointmentId,
      callType,
      callerId: participants.callerId,
      callerName: participants.callerName,
      callerPhoto: participants.callerPhoto,
      channelName: appointmentId,
      targetUserId: participants.calleeId,
    });
  }

  return res.json(ok('Call started', { calleeId: participants.calleeId }));
}

export async function endCall(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { appointmentId } = req.body;
  const participants = await svc.getCallParticipants(req.user.id, appointmentId);

  const io = req.app.locals.io as Server | undefined;
  if (io) {
    io.of('/chat').emit('callEnded', {
      appointmentId,
      endedBy: String(req.user.id),
      targetUserId: participants.calleeId === String(req.user.id) ? participants.callerId : participants.calleeId,
    });
  }

  return res.json(ok('Call ended'));
}

export async function rejectCall(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { appointmentId } = req.body;
  const participants = await svc.getCallParticipants(req.user.id, appointmentId);

  const io = req.app.locals.io as Server | undefined;
  if (io) {
    io.of('/chat').emit('callRejected', {
      appointmentId,
      rejectedBy: String(req.user.id),
      targetUserId: participants.callerId,
    });
  }

  return res.json(ok('Call rejected'));
}
