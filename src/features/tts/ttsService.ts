/**
 * Text-to-Speech (TTS) Service Abstraction
 * 
 * MVP Strategy:
 * Uses Android native TextToSpeech engine abstraction for spoken navigation
 * instructions, detected obstacles, and status updates without recurring cloud TTS fees.
 */

import { TTSPreferences } from '../../types';

export type TTSStateListener = (isSpeaking: boolean, lastSpokenText?: string) => void;

export interface ITTSService {
  speak(text: string): Promise<void>;
  stop(): Promise<void>;
  isSpeaking(): boolean;
  getLastSpokenText(): string;
  setPreferences(prefs: Partial<TTSPreferences>): void;
  getPreferences(): TTSPreferences;
  onStateChange(listener: TTSStateListener): () => void;
}

export class TTSService implements ITTSService {
  private speaking: boolean = false;
  private lastSpokenText: string = '';
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<TTSStateListener> = new Set();

  private preferences: TTSPreferences = {
    speechRate: 1.0,
    pitch: 1.0,
    autoAnnounceDetections: true,
  };

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

  async speak(text: string): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.speaking = true;
    this.lastSpokenText = text;
    this.notifyListeners();

    // In production: will invoke Android TextToSpeech.speak(text, QUEUE_FLUSH, null, utteranceId)
    // Simulate spoken duration based on word count
    const wordCount = text.split(/\s+/).length;
    const durationMs = Math.max(1200, wordCount * 280);

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
