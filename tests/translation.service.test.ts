import mongoose from 'mongoose';
import { getEnv } from '../src/config/env';
import {
  TranslationCacheModel,
  buildTranslationCacheKey,
} from '../src/modules/translation/translation.cache.model';
import { translateText } from '../src/services/translation.service';

const originalFetch = global.fetch;

describe('translation.service', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(getEnv().MONGODB_URI);
    }
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await TranslationCacheModel.deleteMany({
      cacheKey: buildTranslationCacheKey('Hello world', 'ha'),
    });
  });

  it('returns cached translation without calling API on second request', async () => {
    let fetchCalls = 0;
    global.fetch = jest.fn(async () => {
      fetchCalls += 1;
      return {
        ok: true,
        json: async () => ({
          ok: true,
          original_text: 'Hello world',
          translated_text: 'Sannu duniya',
          source_language: 'en',
          target_language: 'ha',
          character_count: 11,
        }),
      };
    }) as typeof fetch;

    const first = await translateText('Hello world', 'ha');
    const second = await translateText('Hello world', 'ha');

    expect(first.translatedText).toBe('Sannu duniya');
    expect(first.fromCache).toBe(false);
    expect(second.translatedText).toBe('Sannu duniya');
    expect(second.fromCache).toBe(true);
    expect(fetchCalls).toBe(1);
  });

});
