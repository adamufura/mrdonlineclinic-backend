import type { APP_LANGUAGES } from '../../config/constants';

export type AppLanguage = (typeof APP_LANGUAGES)[number];

export type TranslationResult = {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: AppLanguage;
  characterCount?: number;
  fromCache: boolean;
};

export type TranslatableMessageFields = {
  content?: string | null;
  messageType?: string;
  contentLanguage?: AppLanguage;
  translations?: Map<string, string> | Record<string, string>;
};

export type EnrichedTextFields = {
  displayContent: string;
  originalContent: string;
  isTranslated: boolean;
};
