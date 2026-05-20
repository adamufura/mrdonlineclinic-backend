import crypto from 'crypto';
import mongoose, { Schema } from 'mongoose';
import type { AppLanguage } from './translation.types';

const translationCacheSchema = new Schema(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    sourceText: { type: String, required: true },
    sourceLanguage: { type: String },
    targetLanguage: { type: String, required: true, enum: ['en', 'ha'] },
    translatedText: { type: String, required: true },
    characterCount: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'translation_cache' },
);

export function buildTranslationCacheKey(text: string, targetLanguage: AppLanguage): string {
  const normalized = text.trim();
  return crypto.createHash('sha256').update(`${normalized}:${targetLanguage}`).digest('hex');
}

export const TranslationCacheModel = mongoose.model('TranslationCache', translationCacheSchema);
