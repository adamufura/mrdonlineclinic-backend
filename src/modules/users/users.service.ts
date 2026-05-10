import type { Types } from 'mongoose';
import { NotFoundError } from '../../shared/errors';
import { UserModel } from './user.model';

export async function getUserById(id: Types.ObjectId | string) {
  const user = await UserModel.findById(id).lean();
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function getUserByEmail(email: string) {
  return UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash +emailVerificationToken +passwordResetToken +invitationToken');
}
