import mongoose, { Schema } from 'mongoose';

const recurringSchema = new Schema(
  {
    practitioner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    slotDurationMinutes: { type: Number, required: true },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'recurring_availabilities' },
);

export const RecurringAvailabilityModel = mongoose.model('RecurringAvailability', recurringSchema);
