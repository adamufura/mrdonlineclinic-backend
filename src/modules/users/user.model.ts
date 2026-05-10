import mongoose, { Schema } from 'mongoose';
import { ADMIN_ROLES, PRACTITIONER_VERIFICATION, USER_STATUSES } from '../../config/constants';

const refreshTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true },
    jti: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String },
    ip: { type: String },
    revokedAt: { type: Date },
  },
  { _id: false },
);

const baseUserSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phoneNumber: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: USER_STATUSES, default: 'PENDING_VERIFICATION', index: true },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastLoginAt: { type: Date },
    refreshTokens: { type: [refreshTokenSchema], default: [] },
  },
  { discriminatorKey: 'role', timestamps: true, collection: 'users' },
);

export type UserDocument = mongoose.InferSchemaType<typeof baseUserSchema> & mongoose.Document;
export const UserModel = mongoose.model('User', baseUserSchema);

const patientSchema = new Schema({
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_SAY'] },
  bloodGroup: {
    type: String,
    enum: ['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN'],
  },
  allergies: [{ type: String }],
  chronicConditions: [{ type: String }],
  currentMedications: [{ type: String }],
  emergencyContact: {
    name: String,
    relationship: String,
    phoneNumber: String,
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
  },
  profilePhotoUrl: { type: String },
  profileCompletedAt: { type: Date },
});

const practitionerSchema = new Schema({
  licenseNumber: { type: String },
  licenseDocumentUrl: { type: String },
  additionalDocuments: [{ type: String }],
  specialties: [{ type: Schema.Types.ObjectId, ref: 'Specialty' }],
  qualifications: [
    {
      degree: String,
      institution: String,
      year: Number,
    },
  ],
  yearsOfExperience: { type: Number },
  bio: { type: String },
  profilePhotoUrl: { type: String },
  consultationLanguages: [{ type: String }],
  verificationStatus: {
    type: String,
    enum: PRACTITIONER_VERIFICATION,
    default: 'UNVERIFIED',
    index: true,
  },
  verificationNotes: { type: String },
  verifiedAt: { type: Date },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  averageRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  isAvailableForBooking: { type: Boolean, default: false, index: true },
  profileCompletedAt: { type: Date },
});

const adminSchema = new Schema({
  adminRole: { type: String, enum: ADMIN_ROLES, required: true, index: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  invitationToken: { type: String, select: false },
  invitationExpires: { type: Date, select: false },
  permissions: [{ type: String }],
});

export const PatientModel = UserModel.discriminator('PATIENT', patientSchema);
export const PractitionerModel = UserModel.discriminator('PRACTITIONER', practitionerSchema);
export const AdminModel = UserModel.discriminator('ADMIN', adminSchema);

export type PatientDocument = InstanceType<typeof PatientModel>;
export type PractitionerDocument = InstanceType<typeof PractitionerModel>;
export type AdminDocument = InstanceType<typeof AdminModel>;
