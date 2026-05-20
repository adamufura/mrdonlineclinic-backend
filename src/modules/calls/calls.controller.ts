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
    svc.notifyIncomingCall(io, participants.calleeId, {
      appointmentId,
      callType,
      callerId: participants.callerId,
      callerName: participants.callerName,
      callerPhoto: participants.callerPhoto,
      channelName: appointmentId,
    });
  }

  return res.json(ok('Call started', { calleeId: participants.calleeId }));
}

export async function acceptCall(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { appointmentId } = req.body;
  const participants = await svc.getCallParticipants(req.user.id, appointmentId);

  const io = req.app.locals.io as Server | undefined;
  if (io) {
    svc.notifyCallAccepted(io, participants.callerId, { appointmentId });
  }

  return res.json(ok('Call accepted'));
}

export async function endCall(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { appointmentId, outcome, durationSeconds, callType } = req.body;
  const participants = await svc.getCallParticipants(req.user.id, appointmentId);
  const otherUserId =
    participants.calleeId === String(req.user.id) ? participants.callerId : participants.calleeId;

  const io = req.app.locals.io as Server | undefined;
  if (io) {
    svc.notifyCallEnded(io, otherUserId, { appointmentId });

    if (outcome && callType) {
      await svc.createCallLogMessage(
        appointmentId,
        req.user.id,
        {
          callType,
          outcome,
          durationSeconds: durationSeconds ?? 0,
        },
        io,
      );
    }
  }

  return res.json(ok('Call ended'));
}

export async function rejectCall(req: Request, res: Response) {
  if (!req.user) throw new AuthError();
  const { appointmentId, callType } = req.body;
  const participants = await svc.getCallParticipants(req.user.id, appointmentId);

  const io = req.app.locals.io as Server | undefined;
  if (io) {
    svc.notifyCallRejected(io, participants.callerId, { appointmentId });

    if (callType) {
      await svc.createCallLogMessage(
        appointmentId,
        req.user.id,
        { callType, outcome: 'rejected' },
        io,
      );
    }
  }

  return res.json(ok('Call rejected'));
}
