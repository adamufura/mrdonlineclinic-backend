import mongoose, { Schema } from 'mongoose';

const medSchema = new Schema(
  {
    drugName: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    duration: { type: String, required: true },
    route: { type: String },
    instructions: { type: String },
  },
  { _id: false },
);

const prescriptionSchema = new Schema(
  {
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    practitioner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    diagnosis: { type: String, required: true },
    medications: { type: [medSchema], required: true },
    additionalNotes: { type: String },
    pdfUrl: { type: String },
    issuedAt: { type: Date, required: true },
    prescriptionNumber: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true, collection: 'prescriptions' },
);

export const PrescriptionModel = mongoose.model('Prescription', prescriptionSchema);
