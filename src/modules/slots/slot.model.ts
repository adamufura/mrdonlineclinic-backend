import mongoose, { Schema } from 'mongoose';
import { SLOT_STATUSES } from '../../config/constants';

const slotSchema = new Schema(
  {
    practitioner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    durationMinutes: { type: Number, required: true },
    status: { type: String, enum: SLOT_STATUSES, default: 'OPEN', index: true },
    recurrenceGroupId: { type: String, index: true },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  },
  { timestamps: true, collection: 'slots' },
);

slotSchema.index({ practitioner: 1, startTime: 1 }, { unique: true });
slotSchema.index({ practitioner: 1, date: 1 });
slotSchema.index({ status: 1, startTime: 1 });

export const SlotModel = mongoose.model('Slot', slotSchema);
