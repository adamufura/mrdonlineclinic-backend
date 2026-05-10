import mongoose, { Schema } from 'mongoose';

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true, index: true },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs' },
);

auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLogModel = mongoose.model('AuditLog', auditLogSchema);
