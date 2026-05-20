import type { Request, Response } from 'express';
import { ok } from '../../shared/envelope';
import { translateBatch, translateText } from '../../services/translation.service';
import type { AppLanguage } from './translation.types';

export async function translate(req: Request, res: Response) {
  const { text, targetLanguage } = req.body as { text: string; targetLanguage: AppLanguage };
  const result = await translateText(text, targetLanguage);
  return res.json(
    ok('Translated', {
      originalText: text,
      translatedText: result.translatedText,
      sourceLanguage: result.sourceLanguage,
      targetLanguage,
      characterCount: result.characterCount,
      fromCache: result.fromCache,
    }),
  );
}

export async function translateBatchHandler(req: Request, res: Response) {
  const { texts, targetLanguage } = req.body as { texts: string[]; targetLanguage: AppLanguage };
  const results = await translateBatch(texts, targetLanguage);
  return res.json(ok('Translated', { items: results, targetLanguage }));
}
