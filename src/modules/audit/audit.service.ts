import type { Request } from 'express';
import type { Types } from 'mongoose';
import { AuditLogModel } from './audit-log.model';

export async function auditLog(input: {
  actor?: Types.ObjectId;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}) {
  await AuditLogModel.create({
    actor: input.actor,
    actorRole: input.actorRole,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata,
    ipAddress: input.req?.ip,
    userAgent: input.req?.get('user-agent'),
  });
}
