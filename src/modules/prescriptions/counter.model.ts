import mongoose, { Schema } from 'mongoose';

const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { collection: 'counters' },
);

export const CounterModel = mongoose.model('Counter', counterSchema);
