import mongoose, { Schema } from 'mongoose';

const reviewSchema = new Schema(
  {
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    practitioner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'reviews' },
);

export const ReviewModel = mongoose.model('Review', reviewSchema);
