import type { Types } from 'mongoose';
import type { AppLanguage } from '../modules/translation/translation.types';
import { UserModel } from '../modules/users/user.model';

export async function getUserPreferredLanguage(userId: Types.ObjectId | string): Promise<AppLanguage> {
  const user = await UserModel.findById(userId).select('preferredLanguage').lean();
  const lang = user?.preferredLanguage;
  if (lang === 'ha' || lang === 'en') return lang;
  return 'en';
}
