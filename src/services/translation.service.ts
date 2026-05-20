import { getEnv } from '../config/env';
import type { AppLanguage } from '../modules/translation/translation.types';
import {
  TranslationCacheModel,
  buildTranslationCacheKey,
} from '../modules/translation/translation.cache.model';

const TRANSLATABLE_MESSAGE_TYPES = new Set(['TEXT', 'SYSTEM', 'CALL', 'FILE']);

type YareResponse = {
  ok: boolean;
  original_text?: string;
  translated_text?: string;
  source_language?: string;
  target_language?: string;
  character_count?: number;
  error?: string;
};

function normalizeText(text: string): string {
  return text.trim();
}

function isEmpty(text: string): boolean {
  return normalizeText(text).length === 0;
}

async function callYareApi(text: string, targetLanguage: AppLanguage): Promise<YareResponse> {
  const env = getEnv();
  const res = await fetch(env.TRANSLATION_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target_language: targetLanguage }),
    signal: AbortSignal.timeout(30_000),
  });

  const data = (await res.json()) as YareResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `Translation API failed (${res.status})`);
  }
  return data;
}

async function getFromCache(text: string, targetLanguage: AppLanguage): Promise<string | null> {
  const cacheKey = buildTranslationCacheKey(text, targetLanguage);
  const row = await TranslationCacheModel.findOne({ cacheKey }).lean();
  return row?.translatedText ?? null;
}

async function saveToCache(
  text: string,
  targetLanguage: AppLanguage,
  translatedText: string,
  sourceLanguage?: string,
  characterCount?: number,
): Promise<void> {
  const cacheKey = buildTranslationCacheKey(text, targetLanguage);
  await TranslationCacheModel.findOneAndUpdate(
    { cacheKey },
    {
      cacheKey,
      sourceText: text,
      sourceLanguage,
      targetLanguage,
      translatedText,
      characterCount,
    },
    { upsert: true },
  );
}

export function isTranslatableMessageType(messageType: string | undefined): boolean {
  return TRANSLATABLE_MESSAGE_TYPES.has(messageType ?? 'TEXT');
}

export async function translateText(
  text: string,
  targetLanguage: AppLanguage,
): Promise<{ translatedText: string; sourceLanguage?: string; characterCount?: number; fromCache: boolean }> {
  const normalized = normalizeText(text);
  if (isEmpty(normalized)) {
    return { translatedText: text, fromCache: true };
  }

  const env = getEnv();
  if (!env.TRANSLATION_API_ENABLED) {
    return { translatedText: text, fromCache: true };
  }

  const cached = await getFromCache(normalized, targetLanguage);
  if (cached) {
    return { translatedText: cached, fromCache: true };
  }

  const data = await callYareApi(normalized, targetLanguage);
  const translatedText = data.translated_text ?? normalized;
  const sourceLanguage = data.source_language;

  if (sourceLanguage === targetLanguage) {
    return { translatedText: normalized, sourceLanguage, characterCount: data.character_count, fromCache: false };
  }

  await saveToCache(normalized, targetLanguage, translatedText, sourceLanguage, data.character_count);

  return {
    translatedText,
    sourceLanguage,
    characterCount: data.character_count,
    fromCache: false,
  };
}

export async function translateBatch(
  texts: string[],
  targetLanguage: AppLanguage,
): Promise<Array<{ originalText: string; translatedText: string; fromCache: boolean }>> {
  const unique = [...new Set(texts.map((t) => normalizeText(t)).filter((t) => t.length > 0))];
  const cacheResults = new Map<string, string>();

  for (const text of unique) {
    const cached = await getFromCache(text, targetLanguage);
    if (cached) cacheResults.set(text, cached);
  }

  const toFetch = unique.filter((t) => !cacheResults.has(t));
  const env = getEnv();

  if (env.TRANSLATION_API_ENABLED) {
    for (const text of toFetch) {
      try {
        const { translatedText } = await translateText(text, targetLanguage);
        cacheResults.set(text, translatedText);
      } catch {
        cacheResults.set(text, text);
      }
    }
  } else {
    for (const text of toFetch) cacheResults.set(text, text);
  }

  return texts.map((original) => {
    const key = normalizeText(original);
    if (isEmpty(key)) {
      return { originalText: original, translatedText: original, fromCache: true };
    }
    return {
      originalText: original,
      translatedText: cacheResults.get(key) ?? original,
      fromCache: cacheResults.has(key),
    };
  });
}

export type EnrichTextInput = {
  text: string;
  contentLanguage?: AppLanguage;
  translations?: Map<string, string> | Record<string, string> | undefined;
  viewerLanguage: AppLanguage;
  onTranslationPersist?: (lang: AppLanguage, translated: string) => Promise<void>;
};

function getStoredTranslation(
  translations: Map<string, string> | Record<string, string> | undefined,
  lang: AppLanguage,
): string | undefined {
  if (!translations) return undefined;
  if (translations instanceof Map) return translations.get(lang);
  return translations[lang];
}

export async function enrichTextForViewer(input: EnrichTextInput): Promise<{
  displayContent: string;
  originalContent: string;
  isTranslated: boolean;
}> {
  const originalContent = input.text ?? '';
  const normalized = normalizeText(originalContent);

  if (isEmpty(normalized)) {
    return { displayContent: originalContent, originalContent, isTranslated: false };
  }

  const viewerLang = input.viewerLanguage;
  const contentLang = input.contentLanguage ?? 'en';

  const stored = getStoredTranslation(input.translations, viewerLang);
  if (stored) {
    return {
      displayContent: stored,
      originalContent,
      isTranslated: stored !== originalContent,
    };
  }

  if (contentLang === viewerLang) {
    return { displayContent: originalContent, originalContent, isTranslated: false };
  }

  try {
    const { translatedText } = await translateText(normalized, viewerLang);
    if (input.onTranslationPersist && translatedText !== originalContent) {
      await input.onTranslationPersist(viewerLang, translatedText);
    }
    return {
      displayContent: translatedText,
      originalContent,
      isTranslated: translatedText !== originalContent,
    };
  } catch {
    return { displayContent: originalContent, originalContent, isTranslated: false };
  }
}

export async function enrichMessageDoc(
  msg: Record<string, unknown>,
  viewerLanguage: AppLanguage,
): Promise<Record<string, unknown>> {
  const messageType = typeof msg.messageType === 'string' ? msg.messageType : 'TEXT';
  const content = typeof msg.content === 'string' ? msg.content : '';

  if (!isTranslatableMessageType(messageType) || isEmpty(content)) {
    return {
      ...msg,
      displayContent: content,
      originalContent: content,
      isTranslated: false,
    };
  }

  const contentLanguage = (msg.contentLanguage as AppLanguage | undefined) ?? 'en';
  const translations = msg.translations as Map<string, string> | Record<string, string> | undefined;
  const msgId = msg._id;

  const enriched = await enrichTextForViewer({
    text: content,
    contentLanguage,
    translations,
    viewerLanguage,
    onTranslationPersist:
      msgId != null
        ? async (lang, translated) => {
            const { MessageModel } = await import('../modules/chat/message.model');
            await MessageModel.updateOne(
              { _id: msgId },
              { $set: { [`translations.${lang}`]: translated } },
            );
          }
        : undefined,
  });

  return { ...msg, ...enriched };
}

export async function enrichMessagesForViewer(
  messages: Record<string, unknown>[],
  viewerLanguage: AppLanguage,
): Promise<Record<string, unknown>[]> {
  return Promise.all(messages.map((m) => enrichMessageDoc(m, viewerLanguage)));
}

export async function enrichAppointmentDoc(
  appt: Record<string, unknown>,
  viewerLanguage: AppLanguage,
): Promise<Record<string, unknown>> {
  const fields = ['reasonForVisit', 'symptoms', 'practitionerNotes'] as const;
  const out: Record<string, unknown> = { ...appt };

  for (const field of fields) {
    const text = typeof appt[field] === 'string' ? (appt[field] as string) : '';
    if (!text.trim()) continue;
    const enriched = await enrichTextForViewer({ text, viewerLanguage, contentLanguage: 'en' });
    out[`display${field.charAt(0).toUpperCase()}${field.slice(1)}`] = enriched.displayContent;
    out[`original${field.charAt(0).toUpperCase()}${field.slice(1)}`] = enriched.originalContent;
    out[`is${field.charAt(0).toUpperCase()}${field.slice(1)}Translated`] = enriched.isTranslated;
  }

  return out;
}

export async function enrichNotificationDoc(
  n: Record<string, unknown>,
  viewerLanguage: AppLanguage,
): Promise<Record<string, unknown>> {
  const title = typeof n.title === 'string' ? n.title : '';
  const body = typeof n.body === 'string' ? n.body : '';

  const [titleEnriched, bodyEnriched] = await Promise.all([
    enrichTextForViewer({ text: title, viewerLanguage, contentLanguage: 'en' }),
    enrichTextForViewer({ text: body, viewerLanguage, contentLanguage: 'en' }),
  ]);

  return {
    ...n,
    displayTitle: titleEnriched.displayContent,
    displayBody: bodyEnriched.displayContent,
    originalTitle: title,
    originalBody: body,
    isTitleTranslated: titleEnriched.isTranslated,
    isBodyTranslated: bodyEnriched.isTranslated,
  };
}
