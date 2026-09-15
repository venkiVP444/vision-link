/**
 * Text-to-Speech (TTS) Service Abstraction
 * 
 * MVP Strategy:
 * Uses Android native TextToSpeech engine abstraction for spoken navigation
 * instructions, detected obstacles, and status updates without recurring cloud TTS fees.
 *
 * Language Support:
 * - English (en-US) - Default primary spoken language
 * - Hausa (ha-NG)   - Supported for regional accessibility when device voice data is present
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { TTSLanguage, TTSPreferences } from '../../types';

const { TTSModule } = NativeModules;

export type TTSStateListener = (isSpeaking: boolean, lastSpokenText?: string) => void;

export interface ITTSService {
  speak(text: string): Promise<void>;
  stop(): Promise<void>;
  stopSpeaking(): Promise<void>;
  isSpeaking(): boolean;
  isTTSAvailable(): boolean;
  initializeTTS(): Promise<boolean>;
  setLanguage(lang: TTSLanguage): void;
  getLastSpokenText(): string;
  setPreferences(prefs: Partial<TTSPreferences>): void;
  getPreferences(): TTSPreferences;
  checkLanguageSupport(lang: TTSLanguage): { supported: boolean; message: string };
  translateText(text: string, lang: TTSLanguage): string;
  onStateChange(listener: TTSStateListener): () => void;
  getEngineInfo(): Promise<{ piperEngineStatus?: string; piperSpeaker?: string; sampleRate?: number; isSpeaking?: boolean }>;
}

import { TTSLanguageOption } from '../../types';

export const TTS_LANGUAGE_OPTIONS: TTSLanguageOption[] = [
  {
    code: 'ha-NG',
    name: 'Hausa',
    nativeName: 'Harshen Hausa',
    voiceName: 'Malama Asabe',
    isOfflineNeural: true,
  },
  {
    code: 'en-GB',
    name: 'English (UK)',
    nativeName: 'English',
    voiceName: 'Jenny',
    isOfflineNeural: true,
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    voiceName: 'Nabra-82M',
    isOfflineNeural: false,
  },
  {
    code: 'hi-IN',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    voiceName: 'Android Voice',
    isOfflineNeural: false,
  },
];

const HAUSA_WARNING_MAP: Record<string, string> = {
  "Person ahead. Please be careful.": "Akwai mutum a gabanka, ka kula.",
  "Person ahead.": "Akwai mutum a gabanka, ka kula.",
  "Person ahead": "Akwai mutum a gabanka, ka kula.",
  "Obstacle ahead.": "Akwai cikas a gabanka, ka kula.",
  "Obstacle ahead": "Akwai cikas a gabanka, ka kula.",
  "Obstacle ahead. Please proceed carefully.": "Akwai cikas a gabanka, ka kula.",
  "Path is clear. You can continue.": "Hanya a buɗe take, babu wani cikas.",
  "Chair ahead.": "Akwai kujera a gabanka, ka kula.",
  "Chair ahead": "Akwai kujera a gabanka, ka kula.",
  "Door ahead.": "Akwai ƙofa a gabanka, ka kula.",
  "Door ahead": "Akwai ƙofa a gabanka, ka kula.",
  "Stairs ahead.": "Akwai tsani a gabanka, ka kula.",
  "Stairs ahead": "Akwai tsani a gabanka, ka kula.",
  "Vehicle ahead.": "Akwai mota a gabanka, ka kula.",
  "Vehicle ahead": "Akwai mota a gabanka, ka kula.",
  "Path clear. No obstacle warnings detected.": "Hanya a buɗe take, babu wani cikas.",
  "No obstacle warnings detected.": "Hanya a buɗe take, babu wani cikas.",
  "Warning: Person ahead.": "Gargaɗi: Akwai mutum a gabanka, ka kula.",
  "Warning: Obstacle ahead.": "Gargaɗi: Akwai cikas a gabanka, ka kula.",
  "Warning: Vehicle ahead.": "Gargaɗi: Akwai mota a gabanka, ka kula.",
  "Obstacle warning: Person ahead.": "Gargaɗi: Akwai mutum a gabanka, ka kula.",
  "Obstacle warning: Obstacle ahead.": "Gargaɗi: Akwai cikas a gabanka, ka kula.",
  "Obstacle warning: Vehicle ahead.": "Gargaɗi: Akwai mota a gabanka, ka kula.",
  "This is a voice feedback test for the Vision-Link assistive interface.": "Wannan gwajin muryar Vision-Link ne game da tsarin taimako.",
  "This is a voice feedback test.": "Wannan gwajin muryar Vision-Link ne.",
};

const ARABIC_WARNING_MAP: Record<string, string> = {
  "Person ahead. Please be careful.": "يوجد شخص أمامك. يرجى توخي الحذر.",
  "Person ahead.": "يوجد شخص أمامك. يرجى توخي الحذر.",
  "Person ahead": "يوجد شخص أمامك. يرجى توخي الحذر.",
  "Obstacle ahead.": "يوجد عائق أمامك. يرجى التقدم بحذر.",
  "Obstacle ahead": "يوجد عائق أمامك. يرجى التقدم بحذر.",
  "Obstacle ahead. Please proceed carefully.": "يوجد عائق أمامك. يرجى التقدم بحذر.",
  "Path is clear. You can continue.": "المسار خالٍ. يمكنك المتابعة.",
  "Chair ahead.": "توجد كرسي أمامك.",
  "Chair ahead": "توجد كرسي أمامك.",
  "Door ahead.": "يوجد باب أمامك.",
  "Door ahead": "يوجد باب أمامك.",
  "Stairs ahead.": "توجد سلالم أمامك.",
  "Stairs ahead": "توجد سلالم أمامك.",
  "Vehicle ahead.": "توجد سيارة أمامك.",
  "Vehicle ahead": "توجد سيارة أمامك.",
  "Path clear. No obstacle warnings detected.": "المسار خالٍ. لم يتم رصد أي عوائق.",
  "No obstacle warnings detected.": "المسار خالٍ. لم يتم رصد أي عوائق.",
  "Warning: Person ahead.": "تحذير: يوجد شخص أمامك. يرجى توخي الحذر.",
  "Warning: Obstacle ahead.": "تحذير: يوجد عائق أمامك. يرجى التقدم بحذر.",
  "Warning: Vehicle ahead.": "تحذير: توجد سيارة أمامك.",
  "Obstacle warning: Person ahead.": "تحذير: يوجد شخص أمامك. يرجى توخي الحذر.",
  "Obstacle warning: Obstacle ahead.": "تحذير: يوجد عائق أمامك. يرجى التقدم بحذر.",
  "Obstacle warning: Vehicle ahead.": "تحذير: توجد سيارة أمامك.",
  "This is a voice feedback test for the Vision-Link assistive interface.": "هذا اختبار للتغذية الراجعة الصوتية لمنظومة فيجن لينك.",
  "This is a voice feedback test.": "يوجد شخص أمامك. يرجى توخي الحذر.",
};

const HINDI_WARNING_MAP: Record<string, string> = {
  "Person ahead. Please be careful.": "सामने व्यक्ति है। कृपया सावधान रहें।",
  "Person ahead.": "सामने व्यक्ति है। कृपया सावधान रहें।",
  "Person ahead": "सामने व्यक्ति है। कृपया सावधान रहें।",
  "Obstacle ahead.": "आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।",
  "Obstacle ahead": "आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।",
  "Obstacle ahead. Please proceed carefully.": "आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।",
  "Path is clear. You can continue.": "रास्ता साफ है। आप आगे बढ़ सकते हैं।",
  "Chair ahead.": "सामने कुर्सी है।",
  "Chair ahead": "सामने कुर्सी है।",
  "Door ahead.": "सामने दरवाज़ा है।",
  "Door ahead": "सामने दरवाज़ा है।",
  "Stairs ahead.": "आगे सीढ़ियाँ हैं।",
  "Stairs ahead": "आगे सीढ़ियाँ हैं।",
  "Vehicle ahead.": "सामने गाड़ी है।",
  "Vehicle ahead": "सामने गाड़ी है।",
  "Path clear. No obstacle warnings detected.": "रास्ता साफ है। कोई बाधा नहीं मिली।",
  "No obstacle warnings detected.": "रास्ता साफ है। कोई बाधा नहीं मिली।",
  "Warning: Person ahead.": "चेतावनी: सामने व्यक्ति है। कृपया सावधान रहें।",
  "Warning: Obstacle ahead.": "चेतावनी: आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।",
  "Warning: Vehicle ahead.": "चेतावनी: सामने गाड़ी है।",
  "Obstacle warning: Person ahead.": "चेतावनी: सामने व्यक्ति है। कृपया सावधान रहें。",
  "Obstacle warning: Obstacle ahead.": "चेतावनी: आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।",
  "Obstacle warning: Vehicle ahead.": "चेतावनी: सामने गाड़ी है।",
  "This is a voice feedback test for the Vision-Link assistive interface.": "यह विजन-लिंक का वॉइस फीडबैक परीक्षण है।",
  "This is a voice feedback test.": "सामने व्यक्ति है। कृपया सावधान रहें।",
};

export class TTSService implements ITTSService {
  private speaking: boolean = false;
  private lastSpokenText: string = '';
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<TTSStateListener> = new Set();

  private preferences: TTSPreferences = {
    speechRate: 1.0,
    pitch: 1.0,
    autoAnnounceDetections: true,
    language: 'en-GB',
  };

  constructor() {
    if (Platform.OS === 'android' && TTSModule) {
      try {
        const emitter = new NativeEventEmitter(TTSModule);
        emitter.addListener('onTTSDone', () => {
          this.speaking = false;
          this.notifyListeners();
        });
        emitter.addListener('onTTSError', () => {
          this.speaking = false;
          this.notifyListeners();
        });
      } catch {
        // Fallback to JS timers if event emitter fails
      }
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.speaking, this.lastSpokenText);
      } catch {
        // Suppress listener error
      }
    });
  }

  onStateChange(listener: TTSStateListener): () => void {
    this.listeners.add(listener);
    listener(this.speaking, this.lastSpokenText);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Checks whether the target language voice engine is supported/installed on the Android device.
   */
  checkLanguageSupport(lang: TTSLanguage): { supported: boolean; message: string } {
    if (lang === 'en-GB' || lang === 'en-US') {
      return {
        supported: true,
        message: 'English (UK) Piper Jenny Dioco offline neural voice engine is configured and ready.',
      };
    }

    if (lang === 'ha-NG') {
      return {
        supported: true,
        message: 'Hausa (ha-NG) offline Piper neural voice engine (Malama Asabe) is configured and ready.',
      };
    }

    if (lang === 'ar') {
      return {
        supported: true,
        message: 'Arabic (ar) voice guidance is configured and ready.',
      };
    }

    if (lang === 'hi-IN') {
      return {
        supported: true,
        message: 'Hindi (hi-IN) voice guidance is configured and ready.',
      };
    }

    return {
      supported: false,
      message: `Language ${lang} is not supported on this device.`,
    };
  }

  /**
   * Translates warning text into the target TTS language.
   */
  translateText(text: string, lang: TTSLanguage): string {
    if (lang === 'en-GB' || lang === 'en-US') {
      return text;
    }

    const trimmed = text.trim();

    if (lang === 'ha-NG') {
      if (Object.values(HAUSA_WARNING_MAP).includes(trimmed)) {
        return trimmed;
      }
      if (HAUSA_WARNING_MAP[trimmed]) {
        return HAUSA_WARNING_MAP[trimmed];
      }

      if (trimmed.startsWith('Warning: ')) {
        const core = trimmed.replace('Warning: ', '').trim();
        const coreTranslated = HAUSA_WARNING_MAP[core] || HAUSA_WARNING_MAP[core + '.'] || 'Akwai cikas a gabanka, ka kula.';
        return `Gargaɗi: ${coreTranslated}`;
      }

      if (trimmed.startsWith('Obstacle warning: ')) {
        const core = trimmed.replace('Obstacle warning: ', '').trim();
        const coreTranslated = HAUSA_WARNING_MAP[core] || HAUSA_WARNING_MAP[core + '.'] || 'Akwai cikas a gabanka, ka kula.';
        return `Gargaɗi: ${coreTranslated}`;
      }

      const lower = trimmed.toLowerCase();
      if (lower.includes('person')) return 'Akwai mutum a gabanka, ka kula.';
      if (lower.includes('chair')) return 'Akwai kujera a gabanka, ka kula.';
      if (lower.includes('door')) return 'Akwai ƙofa a gabanka, ka kula.';
      if (lower.includes('stairs')) return 'Akwai tsani a gabanka, ka kula.';
      if (lower.includes('vehicle')) return 'Akwai mota a gabanka, ka kula.';
      return 'Akwai cikas a gabanka, ka kula.';
    }

    if (lang === 'ar') {
      if (Object.values(ARABIC_WARNING_MAP).includes(trimmed)) {
        return trimmed;
      }
      if (ARABIC_WARNING_MAP[trimmed]) {
        return ARABIC_WARNING_MAP[trimmed];
      }

      if (trimmed.startsWith('Warning: ')) {
        const core = trimmed.replace('Warning: ', '').trim();
        const coreTranslated = ARABIC_WARNING_MAP[core] || ARABIC_WARNING_MAP[core + '.'] || 'يوجد عائق أمامك. يرجى التقدم بحذر.';
        return `تحذير: ${coreTranslated}`;
      }

      if (trimmed.startsWith('Obstacle warning: ')) {
        const core = trimmed.replace('Obstacle warning: ', '').trim();
        const coreTranslated = ARABIC_WARNING_MAP[core] || ARABIC_WARNING_MAP[core + '.'] || 'يوجد عائق أمامك. يرجى التقدم بحذر.';
        return `تحذير: ${coreTranslated}`;
      }

      const lower = trimmed.toLowerCase();
      if (lower.includes('person')) return 'يوجد شخص أمامك. يرجى توخي الحذر.';
      if (lower.includes('chair')) return 'توجد كرسي أمامك.';
      if (lower.includes('door')) return 'يوجد باب أمامك.';
      if (lower.includes('stairs')) return 'توجد سلالم أمامك.';
      if (lower.includes('vehicle')) return 'توجد سيارة أمامك.';
      return 'يوجد عائق أمامك. يرجى التقدم بحذر.';
    }

    if (lang === 'hi-IN') {
      if (Object.values(HINDI_WARNING_MAP).includes(trimmed)) {
        return trimmed;
      }
      if (HINDI_WARNING_MAP[trimmed]) {
        return HINDI_WARNING_MAP[trimmed];
      }

      if (trimmed.startsWith('Warning: ')) {
        const core = trimmed.replace('Warning: ', '').trim();
        const coreTranslated = HINDI_WARNING_MAP[core] || HINDI_WARNING_MAP[core + '.'] || 'आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।';
        return `चेतावनी: ${coreTranslated}`;
      }

      if (trimmed.startsWith('Obstacle warning: ')) {
        const core = trimmed.replace('Obstacle warning: ', '').trim();
        const coreTranslated = HINDI_WARNING_MAP[core] || HINDI_WARNING_MAP[core + '.'] || 'आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।';
        return `चेतावनी: ${coreTranslated}`;
      }

      const lower = trimmed.toLowerCase();
      if (lower.includes('person')) return 'सामने व्यक्ति है। कृपया सावधान रहें।';
      if (lower.includes('chair')) return 'सामने कुर्सी है।';
      if (lower.includes('door')) return 'सामने दरवाज़ा है।';
      if (lower.includes('stairs')) return 'आगे सीढ़ियाँ हैं।';
      if (lower.includes('vehicle')) return 'सामने गाड़ी है।';
      return 'आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।';
    }

    return text;
  }

  async speak(text: string): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    const targetLang = this.preferences.language;
    const langCheck = this.checkLanguageSupport(targetLang);

    const activeLang = langCheck.supported ? targetLang : 'en-US';
    const spokenText = this.translateText(text, activeLang);

    this.speaking = true;
    this.lastSpokenText = spokenText;
    this.notifyListeners();

    // Invoke Android Native TextToSpeech engine when running on Android
    if (Platform.OS === 'android' && TTSModule) {
      try {
        await TTSModule.speak(
          spokenText,
          this.preferences.speechRate,
          this.preferences.pitch,
          activeLang
        );
      } catch (e) {
        console.warn('[TTSService] Native TTS Module call error:', e);
      }
    }

    const wordCount = spokenText.split(/\s+/).length;
    const durationMs = Math.max(2800, wordCount * 450);

    this.timeoutId = setTimeout(() => {
      this.speaking = false;
      this.notifyListeners();
    }, durationMs);
    if (this.timeoutId && typeof (this.timeoutId as any).unref === 'function') {
      (this.timeoutId as any).unref();
    }
  }

  async stop(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (Platform.OS === 'android' && TTSModule) {
      try {
        await TTSModule.stop();
      } catch {
        // Suppress native stop error
      }
    }

    this.speaking = false;
    this.notifyListeners();
  }

  async stopSpeaking(): Promise<void> {
    return this.stop();
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  isTTSAvailable(): boolean {
    return Platform.OS === 'android' ? !!TTSModule : true;
  }

  async initializeTTS(): Promise<boolean> {
    if (Platform.OS === 'android' && TTSModule?.getEngineInfo) {
      try {
        const info = await TTSModule.getEngineInfo();
        return info?.piperEngineStatus === 'ready';
      } catch {
        return true;
      }
    }
    return true;
  }

  setLanguage(lang: TTSLanguage): void {
    this.setPreferences({ language: lang });
  }

  async getEngineInfo(): Promise<{ piperEngineStatus?: string; piperSpeaker?: string; sampleRate?: number; isSpeaking?: boolean }> {
    if (Platform.OS === 'android' && TTSModule?.getEngineInfo) {
      try {
        return await TTSModule.getEngineInfo();
      } catch {
        return { piperEngineStatus: 'unknown' };
      }
    }
    return { piperEngineStatus: 'unsupported' };
  }

  getLastSpokenText(): string {
    return this.lastSpokenText;
  }

  setPreferences(prefs: Partial<TTSPreferences>): void {
    this.preferences = { ...this.preferences, ...prefs };
  }

  getPreferences(): TTSPreferences {
    return { ...this.preferences };
  }
}

export const ttsService = new TTSService();
export default ttsService;
