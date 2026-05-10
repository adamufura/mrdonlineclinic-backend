import mongoose, { Schema } from 'mongoose';
import { APPOINTMENT_STATUSES } from '../../config/constants';

const appointmentSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    practitioner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slot: { type: Schema.Types.ObjectId, ref: 'Slot', required: true },
    scheduledStart: { type: Date, required: true, index: true },
    scheduledEnd: { type: Date, required: true },
    reasonForVisit: { type: String, required: true },
    symptoms: [{ type: String }],
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'PENDING', index: true },
    cancellationReason: { type: String },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    chatRoom: { type: Schema.Types.ObjectId, ref: 'ChatRoom' },
    prescription: { type: Schema.Types.ObjectId, ref: 'Prescription' },
    practitionerNotes: { type: String },
  },
  { timestamps: true, collection: 'appointments' },
);

appointmentSchema.index({ patient: 1, scheduledStart: -1 });
appointmentSchema.index({ practitioner: 1, scheduledStart: -1 });

export const AppointmentModel = mongoose.model('Appointment', appointmentSchema);
