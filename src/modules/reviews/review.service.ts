import type { Types } from 'mongoose';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { refId } from '../appointments/appointment.service';
import { AppointmentModel } from '../appointments/appointment.model';
import { PractitionerModel } from '../users/user.model';
import { ReviewModel } from './review.model';

async function refreshPractitionerRating(practitionerId: Types.ObjectId) {
  const agg = await ReviewModel.aggregate([
    { $match: { practitioner: practitionerId, isVisible: true } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const row = agg[0];
  const avg = row?.avg ?? 0;
  const count = row?.count ?? 0;
  await PractitionerModel.updateOne(
    { _id: practitionerId },
    { $set: { averageRating: Math.round(avg * 10) / 10, totalReviews: count } },
  );
}

export async function createReview(patientId: Types.ObjectId, body: { appointmentId: string; rating: number; comment?: string }) {
  const appt = await AppointmentModel.findById(body.appointmentId);
  if (!appt) throw new NotFoundError('Appointment not found');
  if (!refId(appt.patient).equals(patientId)) throw new ForbiddenError();
  if (appt.status !== 'COMPLETED') throw new ValidationError('You can only review completed appointments');
  const exists = await ReviewModel.exists({ appointment: appt._id });
  if (exists) throw new ConflictError('Review already submitted');

  const review = await ReviewModel.create({
    appointment: appt._id,
    patient: patientId,
    practitioner: appt.practitioner,
    rating: body.rating,
    comment: body.comment,
    isVisible: true,
  });

  await refreshPractitionerRating(appt.practitioner as Types.ObjectId);
  return review.toObject();
}

export async function setVisibilityAdmin(reviewId: string, isVisible: boolean) {
  const review = await ReviewModel.findById(reviewId);
  if (!review) throw new NotFoundError('Review not found');
  review.isVisible = isVisible;
  await review.save();
  await refreshPractitionerRating(review.practitioner as Types.ObjectId);
  return review.toObject();
}
