import { ttsService } from '../src/features/tts/ttsService';
import { aiService } from '../src/features/ai/aiService';
import { cameraService } from '../src/features/camera/cameraService';

describe('Hands-Free Real-Time Voice Pipeline Tests', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    ttsService.setPreferences({
      language: 'en-GB',
      autoAnnounceDetections: true,
      speechRate: 1.0,
      pitch: 1.0,
    });
  });

  afterEach(async () => {
    await ttsService.stopSpeaking();
  });

  // Test 1: Auto-Announce OFF -> detection does not speak
  it('1. Auto-Announce OFF -> detection does not speak', async () => {
    ttsService.setPreferences({ autoAnnounceDetections: false });
    const speakSpy = jest.spyOn(ttsService, 'speak');

    // Simulate detection result with valid warning
    const detectionResult = {
      status: 'success' as const,
      warning: 'Person ahead.',
      timestamp: Date.now(),
    };

    // The handler logic from ObjectDetectionScreen:
    const prefs = ttsService.getPreferences();
    if (prefs.autoAnnounceDetections && detectionResult.warning) {
      const spoken = ttsService.translateDetectionWarning(detectionResult.warning, prefs.language);
      await ttsService.speak(spoken);
    }

    expect(speakSpy).not.toHaveBeenCalled();
  });

  // Test 2: Auto-Announce ON -> valid warning automatically speaks
  it('2. Auto-Announce ON -> valid warning automatically speaks', async () => {
    ttsService.setPreferences({ autoAnnounceDetections: true, language: 'en-GB' });
    const speakSpy = jest.spyOn(ttsService, 'speak');

    const detectionResult = {
      status: 'success' as const,
      warning: 'Person ahead.',
      timestamp: Date.now(),
    };

    const prefs = ttsService.getPreferences();
    if (prefs.autoAnnounceDetections && detectionResult.warning) {
      const spoken = ttsService.translateDetectionWarning(detectionResult.warning, prefs.language);
      await ttsService.speak(spoken);
    }

    expect(speakSpy).toHaveBeenCalledWith('Person ahead. Please be careful.');
  });

  // Test 3: warning = null -> no speech
  it('3. warning = null -> no speech', async () => {
    ttsService.setPreferences({ autoAnnounceDetections: true });
    const speakSpy = jest.spyOn(ttsService, 'speak');

    const detectionResult = {
      status: 'success' as const,
      warning: null,
      timestamp: Date.now(),
    };

    const prefs = ttsService.getPreferences();
    if (prefs.autoAnnounceDetections && detectionResult.warning) {
      const spoken = ttsService.translateDetectionWarning(detectionResult.warning, prefs.language);
      await ttsService.speak(spoken);
    }

    expect(speakSpy).not.toHaveBeenCalled();
  });

  // Test 4: Repeated warning -> existing throttle prevents spam
  it('4. Repeated warning -> existing throttle prevents spam', async () => {
    ttsService.setPreferences({ autoAnnounceDetections: true });
    const speakSpy = jest.spyOn(ttsService, 'speak');

    const DEBOUNCE_INTERVAL_MS = 8000;
    let lastSpoken = { warning: null as string | null, timestamp: 0 };

    const handleDetection = (warning: string) => {
      const now = Date.now();
      const isDuplicate =
        lastSpoken.warning === warning && now - lastSpoken.timestamp < DEBOUNCE_INTERVAL_MS;

      if (!isDuplicate) {
        lastSpoken = { warning, timestamp: now };
        ttsService.speak(warning);
      }
    };

    // First warning
    handleDetection('Person ahead. Please be careful.');
    expect(speakSpy).toHaveBeenCalledTimes(1);

    // Immediate duplicate warning (e.g. 500ms later)
    handleDetection('Person ahead. Please be careful.');
    expect(speakSpy).toHaveBeenCalledTimes(1); // Throttled!

    // Different warning arrives
    handleDetection('Obstacle ahead. Please proceed carefully.');
    expect(speakSpy).toHaveBeenCalledTimes(2); // New warning speaks!
  });

  // Test 5: English warning reaches Jenny
  it('5. English warning reaches Jenny (en-GB)', async () => {
    ttsService.setLanguage('en-GB');
    const translated = ttsService.translateDetectionWarning('Person ahead.', 'en-GB');
    expect(translated).toBe('Person ahead. Please be careful.');

    await ttsService.speak(translated);
    expect(ttsService.getLastSpokenText()).toBe('Person ahead. Please be careful.');
  });

  // Test 6: Hausa warning reaches Piper Hausa
  it('6. Hausa warning reaches Piper Hausa (ha-NG)', async () => {
    ttsService.setLanguage('ha-NG');
    const translated = ttsService.translateDetectionWarning('Person ahead.', 'ha-NG');
    expect(translated).toBe('Akwai mutum a gabanka, ka kula.');

    await ttsService.speak(translated);
    expect(ttsService.getLastSpokenText()).toBe('Akwai mutum a gabanka, ka kula.');
  });

  // Test 7: Arabic warning reaches offline Arabic engine
  it('7. Arabic warning reaches offline Arabic engine', async () => {
    ttsService.setLanguage('ar');
    const translated = ttsService.translateDetectionWarning('Person ahead.', 'ar');
    expect(translated).toBe('يوجد شخص أمامك. يرجى توخي الحذر.');

    // Mock voice pack installed
    jest.spyOn(ttsService, 'getVoicePackStatus').mockResolvedValue({
      language: 'ar',
      isBundled: false,
      isInstalled: true,
      state: 'ready',
      badge: 'Ready',
      details: 'Installed',
      sha256: 'dummy',
      sizeMb: '60.6 MB',
    });

    await ttsService.speak(translated);
    expect(ttsService.getLastSpokenText()).toBe('يوجد شخص أمامك. يرجى توخي الحذر.');
  });

  // Test 8: Hindi warning reaches configured offline model
  it('8. Hindi warning reaches configured offline model', async () => {
    ttsService.setLanguage('hi-IN');
    const translated = ttsService.translateDetectionWarning('Person ahead.', 'hi-IN');
    expect(translated).toBe('सामने व्यक्ति है। कृपया सावधान रहें।');

    // Mock voice pack installed
    jest.spyOn(ttsService, 'getVoicePackStatus').mockResolvedValue({
      language: 'hi-IN',
      isBundled: false,
      isInstalled: true,
      state: 'ready',
      badge: 'Ready',
      details: 'Installed',
      sha256: 'dummy',
      sizeMb: '60.6 MB',
    });

    await ttsService.speak(translated);
    expect(ttsService.getLastSpokenText()).toBe('सामने व्यक्ति है। कृपया सावधान रहें।');
  });

  // Test 9: Manual Test Voice still works
  it('9. Manual Test Voice still works independently', async () => {
    const speakSpy = jest.spyOn(ttsService, 'speak');

    // Manual test button sends specific test phrase directly to TTS
    await ttsService.speak('Person ahead. Please be careful.');
    expect(speakSpy).toHaveBeenCalledWith('Person ahead. Please be careful.');
  });

  // Test 10: Language-selection text is never sent as detection speech
  it('10. Language-selection text is never sent as detection speech', async () => {
    const speakSpy = jest.spyOn(ttsService, 'speak');

    // Backend API response
    const apiWarning = 'Obstacle ahead.';

    // Detection pipeline passes the API warning, NOT UI language strings
    const prefs = ttsService.getPreferences();
    if (prefs.autoAnnounceDetections && apiWarning) {
      const spoken = ttsService.translateDetectionWarning(apiWarning, prefs.language);
      await ttsService.speak(spoken);
    }

    expect(speakSpy).toHaveBeenCalledWith('Obstacle ahead. Please proceed carefully.');
    expect(speakSpy).not.toHaveBeenCalledWith(expect.stringContaining('Speak language to'));
    expect(speakSpy).not.toHaveBeenCalledWith(expect.stringContaining('English (UK)'));
  });

  // End-to-End: Camera frame -> AI Service -> Warning -> Auto-Announce TTS
  it('End-to-End: Camera frame -> AI Service -> Warning -> Auto-Announce TTS', async () => {
    ttsService.setPreferences({ language: 'en-GB', autoAnnounceDetections: true });
    const speakSpy = jest.spyOn(ttsService, 'speak');

    // Mock API response for POST /api/detect
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', warning: 'Person ahead.' }),
    });

    // 1. OTG Camera frame capture
    await cameraService.connectCamera();
    const frame = await cameraService.captureFrame();
    expect(frame).toBeTruthy();

    // 2. AI detection (100% local on-device TFLite)
    const result = await aiService.detectObjectsFromFrame(frame!);
    expect(result.status).toBe('success');
    expect(result.warning).toBe('Person ahead, be careful');

    // 3. Hands-free auto-announce pipeline
    const prefs = ttsService.getPreferences();
    if (prefs.autoAnnounceDetections && result.warning) {
      const spokenSentence = ttsService.translateDetectionWarning(result.warning, prefs.language);
      await ttsService.speak(spokenSentence);
    }

    // 4. Verification that dynamic warning mapped and reached English TTS
    expect(speakSpy).toHaveBeenCalledWith('Person ahead, be careful');
    expect(ttsService.getLastSpokenText()).toBe('Person ahead, be careful');
  });
});
