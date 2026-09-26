/**
 * Text-to-Speech (TTS) Service Abstraction
 * 
 * Multilingual Offline Neural Voice Architecture:
 * - Hausa (ha-NG): Bundled Piper VITS ONNX model (Malama Asabe, 73.5 MB) -> 100% offline from first launch.
 * - English UK (en-GB): Bundled Piper VITS ONNX model (Jenny Dioco, 60.3 MB) -> 100% offline from first launch.
 * - Arabic (ar): Optional Voice Pack (Emirati Female, 60.6 MB) -> Downloaded on-demand, 100% offline once verified.
 * - Hindi (hi-IN): Optional Voice Pack (Priyamvada, 60.6 MB) -> Downloaded on-demand, 100% offline once verified.
 *
 * Zero Silent Fallback:
 * Never silently delegates to Android System TTS when an offline neural model is missing or fails checksum.
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { TTSLanguage, TTSPreferences, TTSLanguageOption } from '../../types';
import { VOICE_REGISTRY, VoicePackStatus, VoiceMetadata } from './voiceRegistry';

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
  checkLanguageAvailability(lang: TTSLanguage): Promise<{ supported: boolean; missingData: boolean; message: string; badge: string }>;
  getVoicePackStatus(lang: TTSLanguage): Promise<VoicePackStatus>;
  downloadVoicePack(lang: TTSLanguage): Promise<{ success: boolean; sha256: string }>;
  deleteVoicePack(lang: TTSLanguage): Promise<boolean>;
  installTtsData(): Promise<boolean>;
  translateText(text: string, lang: TTSLanguage): string;
  translateDetectionWarning(warning: string, lang: TTSLanguage): string;
  onStateChange(listener: TTSStateListener): () => void;
  getEngineInfo(): Promise<{ piperEngineStatus?: string; piperSpeaker?: string; sampleRate?: number; isSpeaking?: boolean }>;
}

export const TTS_LANGUAGE_OPTIONS: TTSLanguageOption[] = [
  {
    code: 'en-GB',
    name: 'English (UK)',
    nativeName: 'English (UK)',
    voiceName: 'Jenny Dioco (RP)',
    isOfflineNeural: true,
  },
  {
    code: 'ha-NG',
    name: 'Hausa',
    nativeName: 'Harshen Hausa',
    voiceName: 'Malama Asabe (F4)',
    isOfflineNeural: true,
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    voiceName: 'Emirati Female',
    isOfflineNeural: true,
  },
  {
    code: 'hi-IN',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    voiceName: 'Priyamvada',
    isOfflineNeural: true,
  },
  {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English (US)',
    voiceName: 'Jenny Dioco (RP)',
    isOfflineNeural: true,
  },
];

const ENGLISH_WARNING_MAP: Record<string, string> = {
  "Person ahead, be careful": "Person ahead, be careful",
  "Person ahead. Be careful.": "Person ahead. Be careful.",
  "Person ahead. Please be careful.": "Person ahead. Please be careful.",
  "Person ahead.": "Person ahead. Please be careful.",
  "Person ahead": "Person ahead. Please be careful.",
  "Car ahead, be careful": "Car ahead, be careful",
  "Car ahead. Be careful.": "Car ahead. Be careful.",
  "Car ahead.": "Car ahead.",
  "Car ahead": "Car ahead.",
  "Chair ahead, be careful": "Chair ahead, be careful",
  "Chair ahead. Be careful.": "Chair ahead. Be careful.",
  "Chair ahead.": "Chair ahead.",
  "Chair ahead": "Chair ahead.",
  "Motorcycle ahead, be careful": "Motorcycle ahead, be careful",
  "Motorcycle ahead. Be careful.": "Motorcycle ahead. Be careful.",
  "Motorcycle ahead.": "Motorcycle ahead.",
  "Motorcycle ahead": "Motorcycle ahead.",
  "Bicycle ahead, be careful": "Bicycle ahead, be careful",
  "Bicycle ahead. Be careful.": "Bicycle ahead. Be careful.",
  "Bicycle ahead.": "Bicycle ahead.",
  "Bicycle ahead": "Bicycle ahead.",
  "Bus ahead, be careful": "Bus ahead, be careful",
  "Bus ahead. Be careful.": "Bus ahead. Be careful.",
  "Truck ahead, be careful": "Truck ahead, be careful",
  "Truck ahead. Be careful.": "Truck ahead. Be careful.",
  "Table ahead, be careful": "Table ahead, be careful",
  "Table ahead. Be careful.": "Table ahead. Be careful.",
  "Bench ahead, be careful": "Bench ahead, be careful",
  "Bench ahead. Be careful.": "Bench ahead. Be careful.",
  "Dog ahead, be careful": "Dog ahead, be careful",
  "Dog ahead. Be careful.": "Dog ahead. Be careful.",
  "Stop sign ahead, be careful": "Stop sign ahead, be careful",
  "Stop sign ahead. Be careful.": "Stop sign ahead. Be careful.",
  "Fire hydrant ahead, be careful": "Fire hydrant ahead, be careful",
  "Fire hydrant ahead. Be careful.": "Fire hydrant ahead. Be careful.",
  "Couch ahead, be careful": "Couch ahead, be careful",
  "Couch ahead. Be careful.": "Couch ahead. Be careful.",
  "Bed ahead, be careful": "Bed ahead, be careful",
  "Bed ahead. Be careful.": "Bed ahead. Be careful.",
  "Toilet ahead, be careful": "Toilet ahead, be careful",
  "Toilet ahead. Be careful.": "Toilet ahead. Be careful.",
  "Potted plant ahead, be careful": "Potted plant ahead, be careful",
  "Potted plant ahead. Be careful.": "Potted plant ahead. Be careful.",
  "Backpack ahead, be careful": "Backpack ahead, be careful",
  "Backpack ahead. Be careful.": "Backpack ahead. Be careful.",
  "Umbrella ahead, be careful": "Umbrella ahead, be careful",
  "Umbrella ahead. Be careful.": "Umbrella ahead. Be careful.",
  "Suitcase ahead, be careful": "Suitcase ahead, be careful",
  "Suitcase ahead. Be careful.": "Suitcase ahead. Be careful.",
  "TV ahead, be careful": "TV ahead, be careful",
  "TV ahead. Be careful.": "TV ahead. Be careful.",
  "Obstacle ahead.": "Obstacle ahead. Please proceed carefully.",
  "Obstacle ahead": "Obstacle ahead. Please proceed carefully.",
  "Warning: Person ahead.": "Warning: Person ahead.",
  "Warning: Obstacle ahead.": "Warning: Obstacle ahead.",
  "Obstacle warning: Person ahead.": "Warning: Person ahead.",
  "Obstacle warning: Obstacle ahead.": "Warning: Obstacle ahead.",
};

const HAUSA_WARNING_MAP: Record<string, string> = {
  "Person ahead, be careful": "Akwai mutum a gabanka, ka kula.",
  "Person ahead. Be careful.": "Akwai mutum a gabanka, ka kula.",
  "Person ahead. Please be careful.": "Akwai mutum a gabanka, ka kula.",
  "Person ahead.": "Akwai mutum a gabanka, ka kula.",
  "Person ahead": "Akwai mutum a gabanka, ka kula.",
  "Car ahead, be careful": "Akwai mota a gabanka, ka kula.",
  "Car ahead. Be careful.": "Akwai mota a gabanka, ka kula.",
  "Car ahead.": "Akwai mota a gabanka, ka kula.",
  "Car ahead": "Akwai mota a gabanka, ka kula.",
  "Chair ahead, be careful": "Akwai kujera a gabanka, ka kula.",
  "Chair ahead. Be careful.": "Akwai kujera a gabanka, ka kula.",
  "Chair ahead.": "Akwai kujera a gabanka, ka kula.",
  "Chair ahead": "Akwai kujera a gabanka, ka kula.",
  "Motorcycle ahead, be careful": "Akwai babur a gabanka, ka kula.",
  "Motorcycle ahead. Be careful.": "Akwai babur a gabanka, ka kula.",
  "Motorcycle ahead.": "Akwai babur a gabanka, ka kula.",
  "Motorcycle ahead": "Akwai babur a gabanka, ka kula.",
  "Bicycle ahead, be careful": "Akwai keke a gabanka, ka kula.",
  "Bicycle ahead. Be careful.": "Akwai keke a gabanka, ka kula.",
  "Bicycle ahead.": "Akwai keke a gabanka, ka kula.",
  "Bicycle ahead": "Akwai keke a gabanka, ka kula.",
  "Bus ahead, be careful": "Akwai motar bas a gabanka, ka kula.",
  "Bus ahead. Be careful.": "Akwai motar bas a gabanka, ka kula.",
  "Truck ahead, be careful": "Akwai babban mota a gabanka, ka kula.",
  "Truck ahead. Be careful.": "Akwai babban mota a gabanka, ka kula.",
  "Table ahead, be careful": "Akwai tebura a gabanka, ka kula.",
  "Table ahead. Be careful.": "Akwai tebura a gabanka, ka kula.",
  "Bench ahead, be careful": "Akwai benci a gabanka, ka kula.",
  "Bench ahead. Be careful.": "Akwai benci a gabanka, ka kula.",
  "Dog ahead, be careful": "Akwai kare a gabanka, ka kula.",
  "Dog ahead. Be careful.": "Akwai kare a gabanka, ka kula.",
  "Stop sign ahead, be careful": "Akwai alamar tsayawa a gabanka, ka kula.",
  "Stop sign ahead. Be careful.": "Akwai alamar tsayawa a gabanka, ka kula.",
  "Fire hydrant ahead, be careful": "Akwai famfon kashe gobara a gabanka, ka kula.",
  "Fire hydrant ahead. Be careful.": "Akwai famfon kashe gobara a gabanka, ka kula.",
  "Couch ahead, be careful": "Akwai kujerar zama a gabanka, ka kula.",
  "Couch ahead. Be careful.": "Akwai kujerar zama a gabanka, ka kula.",
  "Bed ahead, be careful": "Akwai gado a gabanka, ka kula.",
  "Bed ahead. Be careful.": "Akwai gado a gabanka, ka kula.",
  "Toilet ahead, be careful": "Akwai bayan gida a gabanka, ka kula.",
  "Toilet ahead. Be careful.": "Akwai bayan gida a gabanka, ka kula.",
  "Potted plant ahead, be careful": "Akwai shuka a gabanka, ka kula.",
  "Potted plant ahead. Be careful.": "Akwai shuka a gabanka, ka kula.",
  "Backpack ahead, be careful": "Akwai jakar baya a gabanka, ka kula.",
  "Backpack ahead. Be careful.": "Akwai jakar baya a gabanka, ka kula.",
  "Umbrella ahead, be careful": "Akwai laima a gabanka, ka kula.",
  "Umbrella ahead. Be careful.": "Akwai laima a gabanka, ka kula.",
  "Suitcase ahead, be careful": "Akwai akwati a gabanka, ka kula.",
  "Suitcase ahead. Be careful.": "Akwai akwati a gabanka, ka kula.",
  "TV ahead, be careful": "Akwai talabijin a gabanka, ka kula.",
  "TV ahead. Be careful.": "Akwai talabijin a gabanka, ka kula.",
  "Obstacle ahead.": "Akwai cikas a gabanka, ka kula.",
  "Obstacle ahead": "Akwai cikas a gabanka, ka kula.",
  "Obstacle ahead. Please proceed carefully.": "Akwai cikas a gabanka, ka kula.",
  "Path is clear. You can continue.": "Hanya a buɗe take, babu wani cikas.",
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
  "OTG camera connected successfully.": "An haɗa kyamarar OTG cikin nasara.",
  "OTG camera connected successfully": "An haɗa kyamarar OTG cikin nasara.",
  "External camera connected successfully.": "An haɗa kyamarar OTG cikin nasara.",
  "External camera connected successfully": "An haɗa kyamarar OTG cikin nasara.",
  "Connecting to external UVC camera.": "Ana haɗawa da kyamarar OTG.",
  "Connecting to external UVC camera": "Ana haɗawa da kyamarar OTG.",
  "External camera disconnected.": "An cire kyamarar OTG.",
  "External camera disconnected": "An cire kyamarar OTG.",
  "Camera stream paused.": "An dakatar da hoton kyamara.",
  "Live video streaming active.": "Bidiyo mai gudana na aiki.",
  "Camera not connected. Connect external UVC camera to analyze path.": "Ba a haɗa kyamara ba. Haɗa kyamarar OTG don bincika hanya.",
  "No current obstacle analysis available.": "Babu wani binciken cikas a yanzu.",
};

const ARABIC_WARNING_MAP: Record<string, string> = {
  "Person ahead, be careful": "يوجد شخص أمامك. يرجى توخي الحذر.",
  "Person ahead. Be careful.": "يوجد شخص أمامك. يرجى توخي الحذر.",
  "Person ahead. Please be careful.": "يوجد شخص أمامك. يرجى توخي الحذر.",
  "Person ahead.": "يوجد شخص أمامك. يرجى توخي الحذر.",
  "Person ahead": "يوجد شخص أمامك. يرجى توخي الحذر.",
  "Car ahead, be careful": "توجد سيارة أمامك. يرجى توخي الحذر.",
  "Car ahead. Be careful.": "توجد سيارة أمامك. يرجى توخي الحذر.",
  "Car ahead.": "توجد سيارة أمامك.",
  "Car ahead": "توجد سيارة أمامك.",
  "Chair ahead, be careful": "توجد كرسي أمامك. يرجى توخي الحذر.",
  "Chair ahead. Be careful.": "توجد كرسي أمامك. يرجى توخي الحذر.",
  "Chair ahead.": "توجد كرسي أمامك.",
  "Chair ahead": "توجد كرسي أمامك.",
  "Motorcycle ahead, be careful": "توجد دراجة نارية أمامك. يرجى توخي الحذر.",
  "Motorcycle ahead. Be careful.": "توجد دراجة نارية أمامك. يرجى توخي الحذر.",
  "Motorcycle ahead.": "توجد دراجة نارية أمامك.",
  "Motorcycle ahead": "توجد دراجة نارية أمامك.",
  "Bicycle ahead, be careful": "توجد دراجة أمامك. يرجى توخي الحذر.",
  "Bicycle ahead. Be careful.": "توجد دراجة أمامك. يرجى توخي الحذر.",
  "Bicycle ahead.": "توجد دراجة أمامك.",
  "Bicycle ahead": "توجد دراجة أمامك.",
  "Bus ahead, be careful": "توجد حافلة أمامك. يرجى توخي الحذر.",
  "Bus ahead. Be careful.": "توجد حافلة أمامك. يرجى توخي الحذر.",
  "Truck ahead, be careful": "توجد شاحنة أمامك. يرجى توخي الحذر.",
  "Truck ahead. Be careful.": "توجد شاحنة أمامك. يرجى توخي الحذر.",
  "Table ahead, be careful": "توجد طاولة أمامك. يرجى توخي الحذر.",
  "Table ahead. Be careful.": "توجد طاولة أمامك. يرجى توخي الحذر.",
  "Bench ahead, be careful": "يوجد مقعد أمامك. يرجى توخي الحذر.",
  "Bench ahead. Be careful.": "يوجد مقعد أمامك. يرجى توخي الحذر.",
  "Dog ahead, be careful": "يوجد كلب أمامك. يرجى توخي الحذر.",
  "Dog ahead. Be careful.": "يوجد كلب أمامك. يرجى توخي الحذر.",
  "Stop sign ahead, be careful": "توجد إشارة توقف أمامك. يرجى توخي الحذر.",
  "Stop sign ahead. Be careful.": "توجد إشارة توقف أمامك. يرجى توخي الحذر.",
  "Fire hydrant ahead, be careful": "يوجد صنبور إطفاء أمامك. يرجى توخي الحذر.",
  "Fire hydrant ahead. Be careful.": "يوجد صنبور إطفاء أمامك. يرجى توخي الحذر.",
  "Couch ahead, be careful": "توجد أريكة أمامك. يرجى توخي الحذر.",
  "Couch ahead. Be careful.": "توجد أريكة أمامك. يرجى توخي الحذر.",
  "Bed ahead, be careful": "يوجد سرير أمامك. يرجى توخي الحذر.",
  "Bed ahead. Be careful.": "يوجد سرير أمامك. يرجى توخي الحذر.",
  "Toilet ahead, be careful": "يوجد مرحاض أمامك. يرجى توخي الحذر.",
  "Toilet ahead. Be careful.": "يوجد مرحاض أمامك. يرجى توخي الحذر.",
  "Potted plant ahead, be careful": "توجد نبتة أمامك. يرجى توخي الحذر.",
  "Potted plant ahead. Be careful.": "توجد نبتة أمامك. يرجى توخي الحذر.",
  "Backpack ahead, be careful": "توجد حقيبة ظهر أمامك. يرجى توخي الحذر.",
  "Backpack ahead. Be careful.": "توجد حقيبة ظهر أمامك. يرجى توخي الحذر.",
  "Umbrella ahead, be careful": "توجد مظلة أمامك. يرجى توخي الحذر.",
  "Umbrella ahead. Be careful.": "توجد مظلة أمامك. يرجى توخي الحذر.",
  "Suitcase ahead, be careful": "توجد حقيبة سفر أمامك. يرجى توخي الحذر.",
  "Suitcase ahead. Be careful.": "توجد حقيبة سفر أمامك. يرجى توخي الحذر.",
  "TV ahead, be careful": "يوجد تلفاز أمامك. يرجى توخي الحذر.",
  "TV ahead. Be careful.": "يوجد تلفاز أمامك. يرجى توخي الحذر.",
  "Obstacle ahead.": "يوجد عائق أمامك. يرجى التقدم بحذر.",
  "Obstacle ahead": "يوجد عائق أمامك. يرجى التقدم بحذر.",
  "Obstacle ahead. Please proceed carefully.": "يوجد عائق أمامك. يرجى التقدم بحذر.",
  "Path is clear. You can continue.": "المسار خالٍ. يمكنك المتابعة.",
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
  "OTG camera connected successfully.": "تم توصيل كاميرا يو إس بي بنجاح.",
  "OTG camera connected successfully": "تم توصيل كاميرا يو إس بي بنجاح.",
  "External camera connected successfully.": "تم توصيل كاميرا يو إس بي بنجاح.",
  "External camera connected successfully": "تم توصيل كاميرا يو إس بي بنجاح.",
  "Connecting to external UVC camera.": "جارٍ الاتصال بالكاميرا الخارجية.",
  "Connecting to external UVC camera": "جارٍ الاتصال بالكاميرا الخارجية.",
  "External camera disconnected.": "تم فصل الكاميرا الخارجية.",
  "External camera disconnected": "تم فصل الكاميرا الخارجية.",
  "Camera stream paused.": "تم إيقاف بث الكاميرا مؤقتًا.",
  "Live video streaming active.": "بث الفيديو المباشر نشط.",
  "Camera not connected. Connect external UVC camera to analyze path.": "الكاميرا غير متصلة. يرجى توصيل الكاميرا لتحليل المسار.",
  "No current obstacle analysis available.": "لا يوجد تحليل حالي للعوائق.",
};

const HINDI_WARNING_MAP: Record<string, string> = {
  "Person ahead, be careful": "सामने व्यक्ति है। कृपया सावधान रहें।",
  "Person ahead. Be careful.": "सामने व्यक्ति है। कृपया सावधान रहें।",
  "Person ahead. Please be careful.": "सामने व्यक्ति है। कृपया सावधान रहें।",
  "Person ahead.": "सामने व्यक्ति है। कृपया सावधान रहें।",
  "Person ahead": "सामने व्यक्ति है। कृपया सावधान रहें।",
  "Car ahead, be careful": "सामने गाड़ी है। कृपया सावधान रहें।",
  "Car ahead. Be careful.": "सामने गाड़ी है। कृपया सावधान रहें।",
  "Car ahead.": "सामने गाड़ी है। कृपया सावधान रहें।",
  "Car ahead": "सामने गाड़ी है। कृपया सावधान रहें।",
  "Chair ahead, be careful": "सामने कुर्सी है। कृपया सावधान रहें।",
  "Chair ahead. Be careful.": "सामने कुर्सी है। कृपया सावधान रहें।",
  "Chair ahead.": "सामने कुर्सी है।",
  "Chair ahead": "सामने कुर्सी है।",
  "Motorcycle ahead, be careful": "सामने मोटरसाइकिल है। कृपया सावधान रहें।",
  "Motorcycle ahead. Be careful.": "सामने मोटरसाइकिल है। कृपया सावधान रहें।",
  "Motorcycle ahead.": "सामने मोटरसाइकिल है। कृपया सावधान रहें।",
  "Motorcycle ahead": "सामने मोटरसाइकिल है। कृपया सावधान रहें।",
  "Bicycle ahead, be careful": "सामने साइकिल है। कृपया सावधान रहें।",
  "Bicycle ahead. Be careful.": "सामने साइकिल है। कृपया सावधान रहें।",
  "Bicycle ahead.": "सामने साइकिल है। कृपया सावधान रहें।",
  "Bicycle ahead": "सामने साइकिल है। कृपया सावधान रहें।",
  "Bus ahead, be careful": "सामने बस है। कृपया सावधान रहें।",
  "Bus ahead. Be careful.": "सामने बस है। कृपया सावधान रहें।",
  "Truck ahead, be careful": "सामने ट्रक है। कृपया सावधान रहें।",
  "Truck ahead. Be careful.": "सामने ट्रक है। कृपया सावधान रहें।",
  "Table ahead, be careful": "सामने मेज़ है। कृपया सावधान रहें।",
  "Table ahead. Be careful.": "सामने मेज़ है। कृपया सावधान रहें।",
  "Bench ahead, be careful": "सामने बेंच है। कृपया सावधान रहें।",
  "Bench ahead. Be careful.": "सामने बेंच है। कृपया सावधान रहें।",
  "Dog ahead, be careful": "सामने कुत्ता है। कृपया सावधान रहें।",
  "Dog ahead. Be careful.": "सामने कुत्ता है। कृपया सावधान रहें।",
  "Stop sign ahead, be careful": "सामने स्टॉप का संकेत है। कृपया सावधान रहें।",
  "Stop sign ahead. Be careful.": "सामने स्टॉप का संकेत है। कृपया सावधान रहें।",
  "Fire hydrant ahead, be careful": "सामने फायर हाइड्रेंट है। कृपया सावधान रहें।",
  "Fire hydrant ahead. Be careful.": "सामने फायर हाइड्रेंट है। कृपया सावधान रहें।",
  "Couch ahead, be careful": "सामने सोफा है। कृपया सावधान रहें।",
  "Couch ahead. Be careful.": "सामने सोफा है। कृपया सावधान रहें।",
  "Bed ahead, be careful": "सामने बिस्तर है। कृपया सावधान रहें।",
  "Bed ahead. Be careful.": "सामने बिस्तर है। कृपया सावधान रहें।",
  "Toilet ahead, be careful": "सामने शौचालय है। कृपया सावधान रहें।",
  "Toilet ahead. Be careful.": "सामने शौचालय है। कृपया सावधान रहें।",
  "Potted plant ahead, be careful": "सामने गमला है। कृपया सावधान रहें।",
  "Potted plant ahead. Be careful.": "सामने गमला है। कृपया सावधान रहें।",
  "Backpack ahead, be careful": "सामने बैग है। कृपया सावधान रहें।",
  "Backpack ahead. Be careful.": "सामने बैग है। कृपया सावधान रहें।",
  "Umbrella ahead, be careful": "सामने छाता है। कृपया सावधान रहें।",
  "Umbrella ahead. Be careful.": "सामने छाता है। कृपया सावधान रहें।",
  "Suitcase ahead, be careful": "सामने सूटकेस है। कृपया सावधान रहें।",
  "Suitcase ahead. Be careful.": "सामने सूटकेस है। कृपया सावधान रहें।",
  "TV ahead, be careful": "सामने टीवी है। कृपया सावधान रहें।",
  "TV ahead. Be careful.": "सामने टीवी है। कृपया सावधान रहें।",
  "Obstacle ahead.": "आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।",
  "Obstacle ahead": "आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।",
  "Obstacle ahead. Please proceed carefully.": "आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।",
  "Path is clear. You can continue.": "रास्ता साफ है। आप आगे बढ़ सकते हैं।",
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
  "Obstacle warning: Person ahead.": "चेतावनी: सामने व्यक्ति है। कृपया सावधान रहें।",
  "Obstacle warning: Obstacle ahead.": "चेतावनी: आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।",
  "Obstacle warning: Vehicle ahead.": "चेतावनी: सामने गाड़ी है।",
  "This is a voice feedback test for the Vision-Link assistive interface.": "यह विजन-लिंक का वॉइस फीडबैक परीक्षण है।",
  "This is a voice feedback test.": "सामने व्यक्ति है। कृपया सावधान रहें।",
  "OTG camera connected successfully.": "ओटीजी कैमरा सफलतापूर्वक कनेक्ट हो गया।",
  "OTG camera connected successfully": "ओटीजी कैमरा सफलतापूर्वक कनेक्ट हो गया।",
  "External camera connected successfully.": "बाहरी कैमरा सफलतापूर्वक कनेक्ट हो गया।",
  "External camera connected successfully": "बाहरी कैमरा सफलतापूर्वक कनेक्ट हो गया।",
  "Connecting to external UVC camera.": "बाहरी कैमरे से कनेक्ट हो रहा है।",
  "Connecting to external UVC camera": "बाहरी कैमरे से कनेक्ट हो रहा है।",
  "External camera disconnected.": "बाहरी कैमरा डिस्कनेक्ट हो गया।",
  "External camera disconnected": "बाहरी कैमरा डिस्कनेक्ट हो गया।",
  "Camera stream paused.": "कैमरा स्ट्रीम रोक दिया गया।",
  "Live video streaming active.": "लाइव वीडियो स्ट्रीमिंग सक्रिय है।",
  "Camera not connected. Connect external UVC camera to analyze path.": "कैमरा कनेक्ट नहीं है। पथ का विश्लेषण करने के लिए कैमरा कनेक्ट करें।",
  "No current obstacle analysis available.": "वर्तमान में कोई बाधा विश्लेषण उपलब्ध नहीं है।",
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
    return () => {
      this.listeners.delete(listener);
    };
  }

  checkLanguageSupport(lang: TTSLanguage): { supported: boolean; message: string } {
    const meta = VOICE_REGISTRY[lang];
    if (!meta) {
      return { supported: false, message: `Language ${lang} is not supported.` };
    }
    if (meta.isBundled) {
      return { supported: true, message: `${meta.name} is bundled and ready offline.` };
    }
    return {
      supported: false,
      message: `${meta.name}: ${meta.uninstalledBadge}. ${meta.installRequirementNotice}`,
    };
  }

  async getVoicePackStatus(lang: TTSLanguage): Promise<VoicePackStatus> {
    const meta: VoiceMetadata = VOICE_REGISTRY[lang] || VOICE_REGISTRY['en-GB'];
    if (meta.isBundled) {
      return {
        language: lang,
        isBundled: true,
        isInstalled: true,
        state: 'ready',
        badge: meta.installedBadge,
        details: meta.installRequirementNotice,
        sha256: meta.sha256,
        sizeMb: meta.sizeMb,
      };
    }

    if (Platform.OS === 'android' && TTSModule?.getVoicePackStatus) {
      try {
        const res = await TTSModule.getVoicePackStatus(lang);
        const isVerified = res?.isVerified === true;
        return {
          language: lang,
          isBundled: false,
          isInstalled: isVerified,
          state: isVerified ? 'ready' : 'voice_pack_required',
          badge: isVerified ? meta.installedBadge : meta.uninstalledBadge,
          details: isVerified ? `${meta.sizeMb} • 100% Offline Neural` : meta.installRequirementNotice,
          sha256: meta.sha256,
          sizeMb: meta.sizeMb,
        };
      } catch (err) {
        console.warn('[TTSService] getVoicePackStatus error:', err);
      }
    }

    return {
      language: lang,
      isBundled: false,
      isInstalled: false,
      state: 'voice_pack_required',
      badge: meta.uninstalledBadge,
      details: meta.installRequirementNotice,
      sha256: meta.sha256,
      sizeMb: meta.sizeMb,
    };
  }

  async downloadVoicePack(lang: TTSLanguage): Promise<{ success: boolean; sha256: string }> {
    if (Platform.OS === 'android' && TTSModule?.downloadVoicePack) {
      try {
        const res = await TTSModule.downloadVoicePack(lang);
        return {
          success: !!res?.success,
          sha256: res?.sha256 || '',
        };
      } catch (e: any) {
        console.error('[TTSService] downloadVoicePack error:', e?.message || e);
        throw e;
      }
    }
    throw new Error('Voice pack downloading is only available on Android native runtime.');
  }

  async deleteVoicePack(lang: TTSLanguage): Promise<boolean> {
    if (Platform.OS === 'android' && TTSModule?.deleteVoicePack) {
      try {
        await TTSModule.deleteVoicePack(lang);
        return true;
      } catch (e: any) {
        console.warn('[TTSService] deleteVoicePack error:', e?.message || e);
        return false;
      }
    }
    return false;
  }

  async checkLanguageAvailability(lang: TTSLanguage): Promise<{ supported: boolean; missingData: boolean; message: string; badge: string }> {
    const meta = VOICE_REGISTRY[lang] || VOICE_REGISTRY['en-GB'];
    if (meta.isBundled) {
      return {
        supported: true,
        missingData: false,
        message: `${meta.name} offline Piper neural voice engine (${meta.voiceName}) is bundled and ready.`,
        badge: meta.installedBadge,
      };
    }

    const packStatus = await this.getVoicePackStatus(lang);
    if (packStatus.isInstalled) {
      return {
        supported: true,
        missingData: false,
        message: `${meta.name} offline Piper neural voice engine is installed and SHA-256 verified.`,
        badge: meta.installedBadge,
      };
    }

    return {
      supported: false,
      missingData: true,
      message: `${meta.name} requires voice pack installation. ${meta.installRequirementNotice}`,
      badge: meta.uninstalledBadge,
    };
  }

  async installTtsData(): Promise<boolean> {
    if (Platform.OS === 'android' && TTSModule?.installTtsData) {
      try {
        return await TTSModule.installTtsData();
      } catch (e: any) {
        console.warn('[TTSService] installTtsData error:', e?.message || e);
        return false;
      }
    }
    return false;
  }

  translateDetectionWarning(warning: string, lang: TTSLanguage): string {
    const trimmed = warning.trim();
    if (lang === 'en-GB' || lang === 'en-US') {
      if (ENGLISH_WARNING_MAP[trimmed]) {
        return ENGLISH_WARNING_MAP[trimmed];
      }
      const dotVersion = trimmed.replace(/, be careful\b/i, '. Be careful.');
      if (ENGLISH_WARNING_MAP[dotVersion]) {
        return trimmed;
      }
      if (trimmed.startsWith('Warning: ')) {
        const core = trimmed.replace('Warning: ', '').trim();
        if (ENGLISH_WARNING_MAP[core] || ENGLISH_WARNING_MAP[core + '.']) {
          return `Warning: ${ENGLISH_WARNING_MAP[core] || ENGLISH_WARNING_MAP[core + '.']}`;
        }
      }
      return trimmed;
    }
    return this.translateText(trimmed, lang);
  }

  translateText(text: string, lang: TTSLanguage): string {
    if (lang === 'en-GB' || lang === 'en-US') {
      return text;
    }

    const trimmed = text.trim();
    const dotVersion = trimmed.replace(/, be careful\b/i, '. Be careful.');
    const commaVersion = trimmed.replace(/\. Be careful\./i, ', be careful');

    if (lang === 'ha-NG') {
      if (Object.values(HAUSA_WARNING_MAP).includes(trimmed)) {
        return trimmed;
      }
      if (HAUSA_WARNING_MAP[trimmed]) {
        return HAUSA_WARNING_MAP[trimmed];
      }
      if (HAUSA_WARNING_MAP[dotVersion]) {
        return HAUSA_WARNING_MAP[dotVersion];
      }
      if (HAUSA_WARNING_MAP[commaVersion]) {
        return HAUSA_WARNING_MAP[commaVersion];
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
      if (lower.includes('car')) return 'Akwai mota a gabanka, ka kula.';
      if (lower.includes('chair')) return 'Akwai kujera a gabanka, ka kula.';
      if (lower.includes('motorcycle')) return 'Akwai babur a gabanka, ka kula.';
      if (lower.includes('bicycle')) return 'Akwai keke a gabanka, ka kula.';
      if (lower.includes('bus')) return 'Akwai motar bas a gabanka, ka kula.';
      if (lower.includes('truck')) return 'Akwai babban mota a gabanka, ka kula.';
      if (lower.includes('table')) return 'Akwai tebura a gabanka, ka kula.';
      if (lower.includes('bench')) return 'Akwai benci a gabanka, ka kula.';
      if (lower.includes('dog')) return 'Akwai kare a gabanka, ka kula.';
      if (lower.includes('stop sign')) return 'Akwai alamar tsayawa a gabanka, ka kula.';
      if (lower.includes('fire hydrant')) return 'Akwai famfon kashe gobara a gabanka, ka kula.';
      if (lower.includes('couch')) return 'Akwai kujerar zama a gabanka, ka kula.';
      if (lower.includes('bed')) return 'Akwai gado a gabanka, ka kula.';
      if (lower.includes('toilet')) return 'Akwai bayan gida a gabanka, ka kula.';
      if (lower.includes('plant')) return 'Akwai shuka a gabanka, ka kula.';
      if (lower.includes('backpack')) return 'Akwai jakar baya a gabanka, ka kula.';
      if (lower.includes('umbrella')) return 'Akwai laima a gabanka, ka kula.';
      if (lower.includes('suitcase')) return 'Akwai akwati a gabanka, ka kula.';
      if (lower.includes('tv')) return 'Akwai talabijin a gabanka, ka kula.';
      if (lower.includes('door')) return 'Akwai ƙofa a gabanka, ka kula.';
      if (lower.includes('stairs')) return 'Akwai tsani a gabanka, ka kula.';
      if (lower.includes('vehicle')) return 'Akwai mota a gabanka, ka kula.';
      if (lower.includes('connected')) return 'An haɗa kyamarar OTG cikin nasara.';
      if (lower.includes('disconnected')) return 'An cire kyamarar OTG.';
      if (lower.includes('obstacle') || lower.includes('cikas')) return 'Akwai cikas a gabanka, ka kula.';
      return text;
    }

    if (lang === 'ar') {
      if (Object.values(ARABIC_WARNING_MAP).includes(trimmed)) {
        return trimmed;
      }
      if (ARABIC_WARNING_MAP[trimmed]) {
        return ARABIC_WARNING_MAP[trimmed];
      }
      if (ARABIC_WARNING_MAP[dotVersion]) {
        return ARABIC_WARNING_MAP[dotVersion];
      }
      if (ARABIC_WARNING_MAP[commaVersion]) {
        return ARABIC_WARNING_MAP[commaVersion];
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
      if (lower.includes('car')) return 'توجد سيارة أمامك. يرجى توخي الحذر.';
      if (lower.includes('chair')) return 'توجد كرسي أمامك. يرجى توخي الحذر.';
      if (lower.includes('motorcycle')) return 'توجد دراجة نارية أمامك. يرجى توخي الحذر.';
      if (lower.includes('bicycle')) return 'توجد دراجة أمامك. يرجى توخي الحذر.';
      if (lower.includes('bus')) return 'توجد حافلة أمامك. يرجى توخي الحذر.';
      if (lower.includes('truck')) return 'توجد شاحنة أمامك. يرجى توخي الحذر.';
      if (lower.includes('table')) return 'توجد طاولة أمامك. يرجى توخي الحذر.';
      if (lower.includes('bench')) return 'يوجد مقعد أمامك. يرجى توخي الحذر.';
      if (lower.includes('dog')) return 'يوجد كلب أمامك. يرجى توخي الحذر.';
      if (lower.includes('stop sign')) return 'توجد إشارة توقف أمامك. يرجى توخي الحذر.';
      if (lower.includes('fire hydrant')) return 'يوجد صنبور إطفاء أمامك. يرجى توخي الحذر.';
      if (lower.includes('couch')) return 'توجد أريكة أمامك. يرجى توخي الحذر.';
      if (lower.includes('bed')) return 'يوجد سرير أمامك. يرجى توخي الحذر.';
      if (lower.includes('toilet')) return 'يوجد مرحاض أمامك. يرجى توخي الحذر.';
      if (lower.includes('plant')) return 'توجد نبتة أمامك. يرجى توخي الحذر.';
      if (lower.includes('backpack')) return 'توجد حقيبة ظهر أمامك. يرجى توخي الحذر.';
      if (lower.includes('umbrella')) return 'توجد مظلة أمامك. يرجى توخي الحذر.';
      if (lower.includes('suitcase')) return 'توجد حقيبة سفر أمامك. يرجى توخي الحذر.';
      if (lower.includes('tv')) return 'يوجد تلفاز أمامك. يرجى توخي الحذر.';
      if (lower.includes('cat')) return 'توجد قطة أمامك. يرجى توخي الحذر.';
      if (lower.includes('door')) return 'يوجد باب أمامك.';
      if (lower.includes('stairs')) return 'توجد سلالم أمامك.';
      if (lower.includes('vehicle')) return 'توجد سيارة أمامك.';
      if (lower.includes('obstacle') || lower.includes('عائق')) return 'يوجد عائق أمامك. يرجى التقدم بحذر.';
      return text;
    }

    if (lang === 'hi-IN') {
      if (Object.values(HINDI_WARNING_MAP).includes(trimmed)) {
        return trimmed;
      }
      if (HINDI_WARNING_MAP[trimmed]) {
        return HINDI_WARNING_MAP[trimmed];
      }
      if (HINDI_WARNING_MAP[dotVersion]) {
        return HINDI_WARNING_MAP[dotVersion];
      }
      if (HINDI_WARNING_MAP[commaVersion]) {
        return HINDI_WARNING_MAP[commaVersion];
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
      if (lower.includes('car')) return 'सामने गाड़ी है। कृपया सावधान रहें।';
      if (lower.includes('chair')) return 'सामने कुर्सी है। कृपया सावधान रहें।';
      if (lower.includes('motorcycle')) return 'सामने मोटरसाइकिल है। कृपया सावधान रहें।';
      if (lower.includes('bicycle')) return 'सामने साइकिल है। कृपया सावधान रहें।';
      if (lower.includes('bus')) return 'सामने बस है। कृपया सावधान रहें।';
      if (lower.includes('truck')) return 'सामने ट्रक है। कृपया सावधान रहें।';
      if (lower.includes('table')) return 'सामने मेज़ है। कृपया सावधान रहें।';
      if (lower.includes('bench')) return 'सामने बेंच है। कृपया सावधान रहें।';
      if (lower.includes('dog')) return 'सामने कुत्ता है। कृपया सावधान रहें।';
      if (lower.includes('stop sign')) return 'सामने स्टॉप का संकेत है। कृपया सावधान रहें।';
      if (lower.includes('fire hydrant')) return 'सामने फायर हाइड्रेंट है। कृपया सावधान रहें।';
      if (lower.includes('couch')) return 'सामने सोफा है। कृपया सावधान रहें।';
      if (lower.includes('bed')) return 'सामने बिस्तर है। कृपया सावधान रहें।';
      if (lower.includes('toilet')) return 'सामने शौचालय है। कृपया सावधान रहें।';
      if (lower.includes('plant')) return 'सामने गमला है। कृपया सावधान रहें।';
      if (lower.includes('backpack')) return 'सामने बैग है। कृपया सावधान रहें।';
      if (lower.includes('umbrella')) return 'सामने छाता है। कृपया सावधान रहें।';
      if (lower.includes('suitcase')) return 'सामने सूटकेस है। कृपया सावधान रहें।';
      if (lower.includes('tv')) return 'सामने टीवी है। कृपया सावधान रहें।';
      if (lower.includes('cat')) return 'सामने बिल्ली है। कृपया सावधान रहें।';
      if (lower.includes('door')) return 'सामने दरवाज़ा है।';
      if (lower.includes('stairs')) return 'आगे सीढ़ियाँ हैं।';
      if (lower.includes('vehicle')) return 'सामने गाड़ी है।';
      if (lower.includes('obstacle') || lower.includes('रुकावट')) return 'आगे रुकावट है। कृपया सावधानी से आगे बढ़ें।';
      return text;
    }

    return text;
  }

  async speak(text: string, langOverride?: TTSLanguage): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    const targetLang = langOverride || this.preferences.language;
    const spokenText = this.translateText(text, targetLang);

    // Verify voice pack availability for unbundled languages
    const meta = VOICE_REGISTRY[targetLang];
    if (meta && !meta.isBundled) {
      const packStatus = await this.getVoicePackStatus(targetLang);
      if (!packStatus.isInstalled) {
        const err = new Error(
          `Voice Pack Required: ${meta.name} voice pack is not installed. Internet connection required for initial installation.`
        );
        (err as any).code = 'VOICE_PACK_REQUIRED';
        throw err;
      }
    }

    this.speaking = true;
    this.lastSpokenText = spokenText;
    console.log('[EdgeAI] TTS text:', spokenText, 'language:', targetLang);
    this.notifyListeners();

    const activeTTSModule = NativeModules.TTSModule || TTSModule;
    if (activeTTSModule?.speak) {
      try {
        await activeTTSModule.speak(
          spokenText,
          this.preferences.speechRate,
          this.preferences.pitch,
          targetLang
        );
      } catch (e: any) {
        this.speaking = false;
        this.lastSpokenText = '';
        this.notifyListeners();
        console.warn('[TTSService] Native TTS Module call error:', e?.message || e);
        throw e;
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
        return info?.piperHausaStatus === 'ready' || info?.piperEnglishStatus === 'ready';
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
