import mongoose, { Schema } from 'mongoose';

const specialtySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String },
    icon: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'specialties' },
);

export const SpecialtyModel = mongoose.model('Specialty', specialtySchema);
