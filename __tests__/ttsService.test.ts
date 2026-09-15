import { ttsService, TTS_LANGUAGE_OPTIONS } from '../src/features/tts/ttsService';
import { NativeModules } from 'react-native';

describe('Vision-Link Multilingual TTS Service Unit Tests', () => {
  const originalFetch = (globalThis as any).fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    (globalThis as any).fetch = mockFetch;
    ttsService.setPreferences({ language: 'en-GB', speechRate: 1.0, pitch: 1.0 });
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await ttsService.stopSpeaking();
    (globalThis as any).fetch = originalFetch;
  });

  describe('1. Multilingual Translations', () => {
    describe('Hausa (ha-NG) Translations & Hooked Characters', () => {
      it('accurately maps standard warning phrases to authentic Hausa', () => {
        expect(ttsService.translateText('Person ahead. Please be careful.', 'ha-NG'))
          .toBe('Akwai mutum a gabanka, ka kula.');
        expect(ttsService.translateText('Obstacle ahead.', 'ha-NG'))
          .toBe('Akwai cikas a gabanka, ka kula.');
        expect(ttsService.translateText('Path is clear. You can continue.', 'ha-NG'))
          .toBe('Hanya a buɗe take, babu wani cikas.');
        expect(ttsService.translateText('Chair ahead.', 'ha-NG'))
          .toBe('Akwai kujera a gabanka, ka kula.');
        expect(ttsService.translateText('Door ahead.', 'ha-NG'))
          .toBe('Akwai ƙofa a gabanka, ka kula.');
        expect(ttsService.translateText('Stairs ahead.', 'ha-NG'))
          .toBe('Akwai tsani a gabanka, ka kula.');
        expect(ttsService.translateText('Vehicle ahead.', 'ha-NG'))
          .toBe('Akwai mota a gabanka, ka kula.');
      });

      it('strictly preserves Hausa hooked characters (ƙ, ɗ, ɓ)', () => {
        const door = ttsService.translateText('Door ahead.', 'ha-NG');
        expect(door).toContain('ƙ');
        const clear = ttsService.translateText('Path is clear. You can continue.', 'ha-NG');
        expect(clear).toContain('ɗ');
        const warning = ttsService.translateText('Warning: Person ahead.', 'ha-NG');
        expect(warning).toContain('ɗ');
      });
    });

    describe('English (en-GB) Translations', () => {
      it('returns English text verbatim for en-GB and en-US', () => {
        const text = 'Person ahead. Please be careful.';
        expect(ttsService.translateText(text, 'en-GB')).toBe(text);
        expect(ttsService.translateText(text, 'en-US')).toBe(text);
      });
    });

    describe('Arabic (ar) Translations', () => {
      it('accurately maps standard warning phrases to verified Arabic', () => {
        expect(ttsService.translateText('Person ahead. Please be careful.', 'ar'))
          .toBe('يوجد شخص أمامك. يرجى توخي الحذر.');
        expect(ttsService.translateText('Obstacle ahead.', 'ar'))
          .toBe('يوجد عائق أمامك. يرجى التقدم بحذر.');
        expect(ttsService.translateText('Path is clear. You can continue.', 'ar'))
          .toBe('المسار خالٍ. يمكنك المتابعة.');
        expect(ttsService.translateText('Chair ahead.', 'ar'))
          .toBe('توجد كرسي أمامك.');
        expect(ttsService.translateText('Door ahead.', 'ar'))
          .toBe('يوجد باب أمامك.');
        expect(ttsService.translateText('Stairs ahead.', 'ar'))
          .toBe('توجد سلالم أمامك.');
        expect(ttsService.translateText('Vehicle ahead.', 'ar'))
          .toBe('توجد سيارة أمامك.');
      });

      it('formats prefixed warnings correctly in Arabic', () => {
        expect(ttsService.translateText('Warning: Person ahead.', 'ar'))
          .toBe('تحذير: يوجد شخص أمامك. يرجى توخي الحذر.');
        expect(ttsService.translateText('Obstacle warning: Obstacle ahead.', 'ar'))
          .toBe('تحذير: يوجد عائق أمامك. يرجى التقدم بحذر.');
      });
    });

    describe('Hindi (hi-IN) Translations', () => {
      it('accurately maps standard warning phrases to verified Hindi', () => {
        expect(ttsService.translateText('Person ahead. Please be careful.', 'hi-IN'))
          .toBe('सामने व्यक्ति है। कृपया सावधान रहें।');
        expect(ttsService.translateText('Obstacle ahead.', 'hi-IN'))
          .toBe('आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।');
        expect(ttsService.translateText('Path is clear. You can continue.', 'hi-IN'))
          .toBe('रास्ता साफ है। आप आगे बढ़ सकते हैं।');
        expect(ttsService.translateText('Chair ahead.', 'hi-IN'))
          .toBe('सामने कुर्सी है।');
        expect(ttsService.translateText('Door ahead.', 'hi-IN'))
          .toBe('सामने दरवाज़ा है।');
        expect(ttsService.translateText('Stairs ahead.', 'hi-IN'))
          .toBe('आगे सीढ़ियाँ हैं।');
        expect(ttsService.translateText('Vehicle ahead.', 'hi-IN'))
          .toBe('सामने गाड़ी है।');
      });

      it('formats prefixed warnings correctly in Hindi', () => {
        expect(ttsService.translateText('Warning: Person ahead.', 'hi-IN'))
          .toBe('चेतावनी: सामने व्यक्ति है। कृपया सावधान रहें।');
        expect(ttsService.translateText('Obstacle warning: Obstacle ahead.', 'hi-IN'))
          .toBe('चेतावनी: आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।');
      });
    });
  });

  describe('2. Routing & Engine Support', () => {
    it('provides metadata for all 4 team-selected voices in TTS_LANGUAGE_OPTIONS', () => {
      expect(TTS_LANGUAGE_OPTIONS.length).toBe(4);

      const hausaOpt = TTS_LANGUAGE_OPTIONS.find((o) => o.code === 'ha-NG');
      expect(hausaOpt).toBeDefined();
      expect(hausaOpt?.voiceName).toBe('Malama Asabe');
      expect(hausaOpt?.isOfflineNeural).toBe(true);

      const englishOpt = TTS_LANGUAGE_OPTIONS.find((o) => o.code === 'en-GB');
      expect(englishOpt).toBeDefined();
      expect(englishOpt?.voiceName).toBe('Jenny');
      expect(englishOpt?.isOfflineNeural).toBe(true);

      const arabicOpt = TTS_LANGUAGE_OPTIONS.find((o) => o.code === 'ar');
      expect(arabicOpt).toBeDefined();
      expect(arabicOpt?.voiceName).toBe('Nabra-82M');

      const hindiOpt = TTS_LANGUAGE_OPTIONS.find((o) => o.code === 'hi-IN');
      expect(hindiOpt).toBeDefined();
      expect(hindiOpt?.voiceName).toBe('Android Voice');
      expect(hindiOpt?.isOfflineNeural).toBe(false);
    });

    it('verifies language support for all supported codes', () => {
      expect(ttsService.checkLanguageSupport('ha-NG').supported).toBe(true);
      expect(ttsService.checkLanguageSupport('en-GB').supported).toBe(true);
      expect(ttsService.checkLanguageSupport('ar').supported).toBe(true);
      expect(ttsService.checkLanguageSupport('hi-IN').supported).toBe(true);
      expect(ttsService.checkLanguageSupport('en-US').supported).toBe(true);
    });

    it('routes Hausa speech to TTSModule with activeLang ha-NG', async () => {
      ttsService.setLanguage('ha-NG');
      await ttsService.speak('Person ahead. Please be careful.');
      expect(ttsService.getLastSpokenText()).toBe('Akwai mutum a gabanka, ka kula.');
      if (NativeModules.TTSModule?.speak) {
        expect(NativeModules.TTSModule.speak).toHaveBeenCalledWith(
          'Akwai mutum a gabanka, ka kula.',
          1.0,
          1.0,
          'ha-NG'
        );
      }
    });

    it('routes English speech to TTSModule with activeLang en-GB', async () => {
      ttsService.setLanguage('en-GB');
      await ttsService.speak('Person ahead. Please be careful.');
      expect(ttsService.getLastSpokenText()).toBe('Person ahead. Please be careful.');
      if (NativeModules.TTSModule?.speak) {
        expect(NativeModules.TTSModule.speak).toHaveBeenCalledWith(
          'Person ahead. Please be careful.',
          1.0,
          1.0,
          'en-GB'
        );
      }
    });

    it('routes Arabic speech to TTSModule with activeLang ar', async () => {
      ttsService.setLanguage('ar');
      await ttsService.speak('Person ahead. Please be careful.');
      expect(ttsService.getLastSpokenText()).toBe('يوجد شخص أمامك. يرجى توخي الحذر.');
      if (NativeModules.TTSModule?.speak) {
        expect(NativeModules.TTSModule.speak).toHaveBeenCalledWith(
          'يوجد شخص أمامك. يرجى توخي الحذر.',
          1.0,
          1.0,
          'ar'
        );
      }
    });

    it('routes Hindi speech to TTSModule with activeLang hi-IN', async () => {
      ttsService.setLanguage('hi-IN');
      await ttsService.speak('Person ahead. Please be careful.');
      expect(ttsService.getLastSpokenText()).toBe('सामने व्यक्ति है। कृपया सावधान रहें।');
      if (NativeModules.TTSModule?.speak) {
        expect(NativeModules.TTSModule.speak).toHaveBeenCalledWith(
          'सामने व्यक्ति है। कृपया सावधान रहें।',
          1.0,
          1.0,
          'hi-IN'
        );
      }
    });
  });

  describe('3. Error Handling & Edge Cases', () => {
    it('detects unsupported languages and reports supported: false', () => {
      const unsupported = ttsService.checkLanguageSupport('fr-FR' as any);
      expect(unsupported.supported).toBe(false);
      expect(unsupported.message).toContain('not supported');
    });

    it('falls back to default safe language if an unsupported language is requested', async () => {
      ttsService.setLanguage('zh-CN' as any);
      await ttsService.speak('Person ahead.');
      // Should fall back safely to en-US / English without throwing
      expect(ttsService.isSpeaking()).toBe(true);
      await ttsService.stopSpeaking();
    });

    it('gracefully handles native TTSModule failure without crashing', async () => {
      if (NativeModules.TTSModule?.speak) {
        const spy = jest.spyOn(NativeModules.TTSModule, 'speak').mockRejectedValueOnce(new Error('Hardware audio error'));
        await expect(ttsService.speak('Person ahead.')).resolves.not.toThrow();
        spy.mockRestore();
      }
    });
  });

  describe('4. Persistence & Preferences', () => {
    it('updates and persists preferences across calls', () => {
      ttsService.setPreferences({
        language: 'ar',
        speechRate: 1.4,
        pitch: 1.1,
        autoAnnounceDetections: false,
      });

      const prefs = ttsService.getPreferences();
      expect(prefs.language).toBe('ar');
      expect(prefs.speechRate).toBe(1.4);
      expect(prefs.pitch).toBe(1.1);
      expect(prefs.autoAnnounceDetections).toBe(false);
    });

    it('allows changing individual preferences without overriding others', () => {
      ttsService.setPreferences({ language: 'ar', speechRate: 1.4 });
      ttsService.setPreferences({ language: 'hi-IN' });
      expect(ttsService.getPreferences().language).toBe('hi-IN');
      expect(ttsService.getPreferences().speechRate).toBe(1.4); // Preserved from previous setPreferences

      ttsService.setPreferences({ speechRate: 1.0 });
      expect(ttsService.getPreferences().language).toBe('hi-IN');
      expect(ttsService.getPreferences().speechRate).toBe(1.0);
    });
  });

  describe('5. Offline Guarantee (Zero Network Traffic During TTS)', () => {
    it('synthesizes speech without calling global fetch across all languages', async () => {
      const testLanguages = ['ha-NG', 'en-GB', 'ar', 'hi-IN'] as const;

      for (const lang of testLanguages) {
        ttsService.setLanguage(lang);
        await ttsService.speak('Person ahead. Please be careful.');
        expect(mockFetch).not.toHaveBeenCalled();
        await ttsService.stopSpeaking();
      }
    });
  });
});
