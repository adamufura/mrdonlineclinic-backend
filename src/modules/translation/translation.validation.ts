import { z } from 'zod';
import { APP_LANGUAGES } from '../../config/constants';

const languageSchema = z.enum(APP_LANGUAGES);

export const translateBodySchema = z.object({
  text: z.string().min(1).max(10_000),
  targetLanguage: languageSchema,
});

export const translateBatchBodySchema = z.object({
  texts: z.array(z.string().max(10_000)).min(1).max(50),
  targetLanguage: languageSchema,
});
