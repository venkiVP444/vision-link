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
  isSpeaking(): boolean;
  getLastSpokenText(): string;
  setPreferences(prefs: Partial<TTSPreferences>): void;
  getPreferences(): TTSPreferences;
  checkLanguageSupport(lang: TTSLanguage): { supported: boolean; message: string };
  translateText(text: string, lang: TTSLanguage): string;
  onStateChange(listener: TTSStateListener): () => void;
}

const HAUSA_WARNING_MAP: Record<string, string> = {
  "Person ahead. Please be careful.": "Akwai mutum a gabanka, ka kula.",
  "Person ahead.": "Akwai mutum a gabanka, ka kula.",
  "Person ahead": "Akwai mutum a gabanka, ka kula.",
  "Obstacle ahead.": "Akwai cikas a gabanka, ka kula.",
  "Obstacle ahead": "Akwai cikas a gabanka, ka kula.",
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

export class TTSService implements ITTSService {
  private speaking: boolean = false;
  private lastSpokenText: string = '';
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<TTSStateListener> = new Set();

  private preferences: TTSPreferences = {
    speechRate: 1.0,
    pitch: 1.0,
    autoAnnounceDetections: true,
    language: 'en-US',
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
    if (lang === 'en-US') {
      return {
        supported: true,
        message: 'English (en-US) voice engine is installed and fully supported.',
      };
    }

    if (lang === 'ha-NG') {
      return {
        supported: true,
        message: 'Hausa (ha-NG) voice translation is configured.',
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
    if (lang === 'en-US') {
      return text;
    }

    if (lang === 'ha-NG') {
      const trimmed = text.trim();
      if (HAUSA_WARNING_MAP[trimmed]) {
        return HAUSA_WARNING_MAP[trimmed];
      }

      // Check prefix handling
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

      // Contextual fallback by keyword
      const lower = trimmed.toLowerCase();
      if (lower.includes('person')) {
        return 'Akwai mutum a gabanka, ka kula.';
      }
      if (lower.includes('chair')) {
        return 'Akwai kujera a gabanka, ka kula.';
      }
      if (lower.includes('door')) {
        return 'Akwai ƙofa a gabanka, ka kula.';
      }
      if (lower.includes('stairs')) {
        return 'Akwai tsani a gabanka, ka kula.';
      }
      if (lower.includes('vehicle')) {
        return 'Akwai mota a gabanka, ka kula.';
      }

      // General Hausa warning fallback
      return 'Akwai cikas a gabanka, ka kula.';
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

  isSpeaking(): boolean {
    return this.speaking;
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
