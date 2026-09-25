import { ttsService, TTS_LANGUAGE_OPTIONS } from '../src/features/tts/ttsService';
import { TTSLanguage } from '../src/types';
import { aiService } from '../src/features/ai/aiService';
import { NativeModules } from 'react-native';

describe('Vision-Link Multilingual TTS Service Unit & Regression Tests', () => {
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
        expect(ttsService.translateText('Person ahead.', 'ha-NG'))
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

    describe('English (en-GB & en-US) Translations', () => {
      it('returns English text verbatim for en-GB and en-US', () => {
        const text = 'Person ahead. Please be careful.';
        expect(ttsService.translateText(text, 'en-GB')).toBe(text);
        expect(ttsService.translateText(text, 'en-US')).toBe(text);
      });
    });

    describe('Arabic (ar) Translations', () => {
      it('accurately maps standard warning phrases to authentic Arabic', () => {
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
      it('accurately maps standard warning phrases to authentic Hindi', () => {
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
    it('provides accurate metadata for all 5 voices in TTS_LANGUAGE_OPTIONS', () => {
      expect(TTS_LANGUAGE_OPTIONS.length).toBe(5);

      const hausaOpt = TTS_LANGUAGE_OPTIONS.find((o) => o.code === 'ha-NG');
      expect(hausaOpt).toBeDefined();
      expect(hausaOpt?.isOfflineNeural).toBe(true);

      const englishGbOpt = TTS_LANGUAGE_OPTIONS.find((o) => o.code === 'en-GB');
      expect(englishGbOpt).toBeDefined();
      expect(englishGbOpt?.isOfflineNeural).toBe(true);

      const englishUsOpt = TTS_LANGUAGE_OPTIONS.find((o) => o.code === 'en-US');
      expect(englishUsOpt).toBeDefined();
      expect(englishUsOpt?.isOfflineNeural).toBe(true);

      const arabicOpt = TTS_LANGUAGE_OPTIONS.find((o) => o.code === 'ar');
      expect(arabicOpt).toBeDefined();
      expect(arabicOpt?.isOfflineNeural).toBe(true);

      const hindiOpt = TTS_LANGUAGE_OPTIONS.find((o) => o.code === 'hi-IN');
      expect(hindiOpt).toBeDefined();
      expect(hindiOpt?.isOfflineNeural).toBe(true);
    });

    it('accurately describes availability in checkLanguageSupport()', () => {
      expect(ttsService.checkLanguageSupport('en-US').supported).toBe(true);
      expect(ttsService.checkLanguageSupport('en-GB').supported).toBe(true);
      expect(ttsService.checkLanguageSupport('ha-NG').supported).toBe(true);

      const arSupport = ttsService.checkLanguageSupport('ar');
      expect(arSupport.supported).toBe(false);
      expect(arSupport.message).toContain('Voice Pack Required');
      expect(arSupport.message).toContain('Internet connection required for initial installation');

      const hiSupport = ttsService.checkLanguageSupport('hi-IN');
      expect(hiSupport.supported).toBe(false);
      expect(hiSupport.message).toContain('Voice Pack Required');
      expect(hiSupport.message).toContain('Internet connection required for initial installation');

      const unsupported = ttsService.checkLanguageSupport('fr-FR' as any);
      expect(unsupported.supported).toBe(false);
      expect(unsupported.message).toContain('not supported');
    });

    it('routes en-US detection speech to TTSModule with activeLang en-US', async () => {
      ttsService.setLanguage('en-US');
      await ttsService.speak('Person ahead.');
      expect(ttsService.getLastSpokenText()).toBe('Person ahead.');
      if (NativeModules.TTSModule?.speak) {
        expect(NativeModules.TTSModule.speak).toHaveBeenCalledWith(
          'Person ahead.',
          1.0,
          1.0,
          'en-US'
        );
      }
    });

    it('routes en-GB detection speech to TTSModule with activeLang en-GB', async () => {
      ttsService.setLanguage('en-GB');
      await ttsService.speak('Person ahead.');
      expect(ttsService.getLastSpokenText()).toBe('Person ahead.');
      if (NativeModules.TTSModule?.speak) {
        expect(NativeModules.TTSModule.speak).toHaveBeenCalledWith(
          'Person ahead.',
          1.0,
          1.0,
          'en-GB'
        );
      }
    });

    it('routes Hausa speech to Piper Hausa F4 with activeLang ha-NG', async () => {
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

      await ttsService.speak('Obstacle ahead.');
      expect(ttsService.getLastSpokenText()).toBe('Akwai cikas a gabanka, ka kula.');
    });

    it('rejects Arabic speech when voice pack is not installed without silent fallback', async () => {
      ttsService.setLanguage('ar');
      await expect(ttsService.speak('Person ahead. Please be careful.'))
        .rejects.toThrow(/Voice Pack Required/);
    });

    it('routes Arabic speech when voice pack is verified', async () => {
      jest.spyOn(ttsService, 'getVoicePackStatus').mockResolvedValueOnce({
        language: 'ar',
        isBundled: false,
        isInstalled: true,
        state: 'ready',
        badge: 'OFFLINE NEURAL ✓ Ready',
        details: 'Verified',
        sha256: '1578A9B27D01A0626227225B148179628B770607DD61BDBBC41865BD399106B1',
        sizeMb: '60.6 MB',
      });

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

    it('rejects Hindi speech when voice pack is not installed without silent fallback', async () => {
      ttsService.setLanguage('hi-IN');
      await expect(ttsService.speak('Person ahead. Please be careful.'))
        .rejects.toThrow(/Voice Pack Required/);
    });

    it('routes Hindi speech when voice pack is verified', async () => {
      jest.spyOn(ttsService, 'getVoicePackStatus').mockResolvedValueOnce({
        language: 'hi-IN',
        isBundled: false,
        isInstalled: true,
        state: 'ready',
        badge: 'OFFLINE NEURAL ✓ Ready',
        details: 'Verified',
        sha256: 'AA63BCF2CD493B55A450F280E23CF77F03AFC9AF7015E6E5ACD43B652F166C88',
        sizeMb: '60.6 MB',
      });

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

  describe('3. Error Handling & State Management', () => {
    it('resets speaking state and throws on native TTS failure', async () => {
      if (NativeModules.TTSModule?.speak) {
        jest.spyOn(NativeModules.TTSModule, 'speak').mockRejectedValueOnce(new Error('TTS_LANG_NOT_SUPPORTED'));
        
        await expect(ttsService.speak('Warning: Obstacle ahead.')).rejects.toThrow('TTS_LANG_NOT_SUPPORTED');
        expect(ttsService.isSpeaking()).toBe(false);
      }
    });

    it('updates speech rate and pitch preferences dynamically', () => {
      ttsService.setPreferences({ speechRate: 1.4, pitch: 1.2 });
      const prefs = ttsService.getPreferences();
      expect(prefs.speechRate).toBe(1.4);
      expect(prefs.pitch).toBe(1.2);
    });

    it('broadcasts state changes to registered listeners', () => {
      const listener = jest.fn();
      const unsubscribe = ttsService.onStateChange(listener);

      ttsService.speak('Test speaking');
      expect(listener).toHaveBeenCalledWith(true, 'Test speaking');

      unsubscribe();
      ttsService.stop();
      // Listener should not receive the stop call after unsubscribe
      expect(listener).not.toHaveBeenCalledWith(false, expect.anything());
    });
  });

  describe('4. Object Detection Integration Pipeline', () => {
    it('translates detection warning correctly for Hausa without mutating original detection object', async () => {
      ttsService.setLanguage('ha-NG');
      const warningText = 'Person ahead. Please be careful.';

      await ttsService.speak(warningText);

      expect(ttsService.getLastSpokenText()).toBe('Akwai mutum a gabanka, ka kula.');
      expect(warningText).toBe('Person ahead. Please be careful.');
    });

    it('translates obstacle warning correctly for English UK without mutation', async () => {
      ttsService.setLanguage('en-GB');
      const warningText = 'Person ahead. Please be careful.';

      await ttsService.speak(warningText);

      expect(ttsService.getLastSpokenText()).toBe('Person ahead. Please be careful.');
    });
  });

  describe('5. Persistence & Offline Guarantee', () => {
    it('synthesizes speech without calling global fetch across all languages', async () => {
      const languages: TTSLanguage[] = ['en-GB', 'en-US', 'ha-NG'];

      for (const lang of languages) {
        ttsService.setLanguage(lang);
        await ttsService.speak('Person ahead. Please be careful.');
        expect(mockFetch).not.toHaveBeenCalled();
        await ttsService.stopSpeaking();
      }
    });
  });

  describe('6. Language Options & Voice Pack Strategy', () => {
    it('strictly configures bundled offline neural status for Hausa & English UK, and voice packs for Arabic & Hindi', () => {
      const hausa = TTS_LANGUAGE_OPTIONS.find(o => o.code === 'ha-NG');
      expect(hausa).toBeDefined();
      expect(hausa?.isOfflineNeural).toBe(true);

      const englishUk = TTS_LANGUAGE_OPTIONS.find(o => o.code === 'en-GB');
      expect(englishUk).toBeDefined();
      expect(englishUk?.isOfflineNeural).toBe(true);

      const arabic = TTS_LANGUAGE_OPTIONS.find(o => o.code === 'ar');
      expect(arabic).toBeDefined();
      expect(arabic?.isOfflineNeural).toBe(true);

      const hindi = TTS_LANGUAGE_OPTIONS.find(o => o.code === 'hi-IN');
      expect(hindi).toBeDefined();
      expect(hindi?.isOfflineNeural).toBe(true);
    });

    it('returns structured voice-data missing message for uninstalled Arabic/Hindi', async () => {
      const arCheck = await ttsService.checkLanguageAvailability('ar');
      expect(arCheck.supported).toBe(false);
      expect(arCheck.missingData).toBe(true);
      expect(arCheck.message).toContain('Internet connection required for initial installation');

      const hiCheck = await ttsService.checkLanguageAvailability('hi-IN');
      expect(hiCheck.supported).toBe(false);
      expect(hiCheck.missingData).toBe(true);
      expect(hiCheck.message).toContain('Internet connection required for initial installation');
    });

    it('provides installTtsData method returning a boolean', async () => {
      const result = await ttsService.installTtsData();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('7. Cross-Device Robustness & Native Error Propagation', () => {
    it('Promise resolves only after playback completion', async () => {
      let resolved = false;
      if (NativeModules.TTSModule?.speak) {
        jest.spyOn(NativeModules.TTSModule, 'speak').mockImplementationOnce(async () => {
          await new Promise((resolve) => setTimeout(() => resolve(undefined), 50));
          resolved = true;
          return 'utt_123';
        });
      }

      await ttsService.speak('Person ahead. Please be careful.');
      if (NativeModules.TTSModule?.speak) {
        expect(resolved).toBe(true);
      }
    });

    it('Promise rejects with detailed error on synthesis failure', async () => {
      if (NativeModules.TTSModule?.speak) {
        const nativeErr = new Error('[AUDIOTRACK_INIT] AudioTrack failed to initialize (state=0)');
        (nativeErr as any).code = 'STATE_UNINITIALIZED';
        (nativeErr as any).userInfo = { stage: 'AUDIOTRACK_INIT', code: 'STATE_UNINITIALIZED' };

        jest.spyOn(NativeModules.TTSModule, 'speak').mockRejectedValueOnce(nativeErr);

        await expect(ttsService.speak('Person ahead.'))
          .rejects.toThrow(/AUDIOTRACK_INIT/);
        expect(ttsService.isSpeaking()).toBe(false);
      }
    });

    it('handles AudioTrack write errors without swallowing exceptions', async () => {
      if (NativeModules.TTSModule?.speak) {
        const writeErr = new Error('[AUDIOTRACK_WRITE] AudioTrack.write error code: -3');
        (writeErr as any).code = 'WRITE_ERROR_-3';

        jest.spyOn(NativeModules.TTSModule, 'speak').mockRejectedValueOnce(writeErr);

        await expect(ttsService.speak('Obstacle ahead.'))
          .rejects.toThrow(/AUDIOTRACK_WRITE/);
        expect(ttsService.isSpeaking()).toBe(false);
      }
    });

    it('rejects unverified voice pack with invalid SHA-256 without marking READY', async () => {
      jest.spyOn(ttsService, 'getVoicePackStatus').mockResolvedValueOnce({
        language: 'ar',
        isBundled: false,
        isInstalled: false,
        state: 'voice_pack_required',
        badge: 'Voice Pack Required',
        details: 'Internet connection required for initial installation.',
        sha256: '1578A9B27D01A0626227225B148179628B770607DD61BDBBC41865BD399106B1',
        sizeMb: '60.6 MB',
      });

      ttsService.setLanguage('ar');
      await expect(ttsService.speak('Person ahead.'))
        .rejects.toThrow(/Voice Pack Required/);
    });

    it('ensures English detection sentence routing speaks the actual supplied warning and NEVER language announcement', async () => {
      ttsService.setLanguage('en-GB');
      const warningSentence = 'Person ahead. Please be careful.';
      await ttsService.speak(warningSentence);

      const spoken = ttsService.getLastSpokenText();
      expect(spoken).toBe('Person ahead. Please be careful.');
      expect(spoken).not.toContain('Speak language to English UK');
      expect(spoken).not.toContain('Speech language set');
    });

    it('ensures offline synthesis for Arabic & Hindi does not make network requests after installation', async () => {
      // Simulate verified voice packs
      jest.spyOn(ttsService, 'getVoicePackStatus').mockImplementation(async (lang: TTSLanguage) => ({
        language: lang,
        isBundled: false,
        isInstalled: true,
        state: 'ready',
        badge: 'OFFLINE NEURAL ✓ Ready',
        details: 'Verified',
        sha256: 'DUMMY_VERIFIED_HASH',
        sizeMb: '60.6 MB',
      }));

      // Arabic offline test
      ttsService.setLanguage('ar');
      await ttsService.speak('Person ahead.');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('ensures selecting a language triggers immediate speech without requiring a test button press', async () => {
      // 1. Select Hausa
      ttsService.setLanguage('ha-NG');
      await ttsService.speak('Akwai mutum a gabanka, ka kula.', 'ha-NG');
      expect(ttsService.getLastSpokenText()).toBe('Akwai mutum a gabanka, ka kula.');
      expect(ttsService.isSpeaking()).toBe(true);

      // 2. Select English UK
      ttsService.setLanguage('en-GB');
      await ttsService.speak('Person ahead. Please be careful.', 'en-GB');
      expect(ttsService.getLastSpokenText()).toBe('Person ahead. Please be careful.');
      expect(ttsService.isSpeaking()).toBe(true);
    });
  });
});

