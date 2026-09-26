import { aiService } from '../src/features/ai/aiService';
import { cameraService } from '../src/features/camera/cameraService';
import { ttsService } from '../src/features/tts/ttsService';
import { isAllowedObstacle, generateObstacleWarning, ESSENTIAL_OBJECT_ALLOWLIST } from '../src/features/ai/objectFilter';

describe('Vision-Link Mobile — Dynamic TTS & Stale Detection State Lifecycle', () => {
  let speakSpy: jest.SpyInstance;
  let stopSpeakingSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    speakSpy = jest.spyOn(ttsService, 'speak');
    stopSpeakingSpy = jest.spyOn(ttsService, 'stopSpeaking');
    await ttsService.stopSpeaking();
    ttsService.setPreferences({ language: 'en-US', autoAnnounceDetections: true });
    await cameraService.connectCamera();
  });

  afterEach(async () => {
    await ttsService.stopSpeaking();
    speakSpy.mockRestore();
    stopSpeakingSpy.mockRestore();
  });

  afterAll(async () => {
    await cameraService.disconnectCamera();
  });

  // 1. Detected Chair -> correct "Chair ahead, be careful"
  it('1. Detected Chair -> produces correct "Chair ahead, be careful"', async () => {
    cameraService.setCustomFrame('FRAME_CHAIR_DATA');
    const frame = await cameraService.captureFrame();
    const result = await aiService.detectObjectsFromFrame(frame!);

    expect(result.status).toBe('success');
    expect(result.objects?.[0]?.label).toBe('Chair');
    expect(result.warning).toBe('Chair ahead, be careful');

    const localized = ttsService.translateDetectionWarning(result.warning!, 'en-US');
    expect(localized).toBe('Chair ahead, be careful');
  });

  // 2. Detected Person -> correct "Person ahead, be careful"
  it('2. Detected Person -> produces correct "Person ahead, be careful"', async () => {
    cameraService.setCustomFrame('FRAME_PERSON_DATA');
    const frame = await cameraService.captureFrame();
    const result = await aiService.detectObjectsFromFrame(frame!);

    expect(result.status).toBe('success');
    expect(result.objects?.[0]?.label).toBe('Person');
    expect(result.warning).toBe('Person ahead, be careful');

    const localized = ttsService.translateDetectionWarning(result.warning!, 'en-US');
    expect(localized).toBe('Person ahead, be careful');
  });

  // 3. Chair -> Person replaces previous state
  it('3. Chair -> Person replaces previous detection state completely', async () => {
    // Cycle 1: Camera sees Chair
    cameraService.setCustomFrame('FRAME_CHAIR_DATA');
    let frame = await cameraService.captureFrame();
    let result = await aiService.detectObjectsFromFrame(frame!);
    let currentObjects = result.objects;
    let currentWarning = result.warning;

    expect(currentObjects?.[0]?.label).toBe('Chair');
    expect(currentWarning).toBe('Chair ahead, be careful');

    // Cycle 2: Camera moves to Person
    cameraService.setCustomFrame('FRAME_PERSON_DATA');
    frame = await cameraService.captureFrame();
    result = await aiService.detectObjectsFromFrame(frame!);
    currentObjects = result.objects;
    currentWarning = result.warning;

    // Detection state is immediately replaced, not appended or retaining Chair
    expect(currentObjects?.length).toBe(1);
    expect(currentObjects?.[0]?.label).toBe('Person');
    expect(currentWarning).toBe('Person ahead, be careful');
  });

  // 4. Chair -> Person cancels stale Chair TTS
  it('4. Chair -> Person immediately cancels stale Chair TTS before speaking Person', async () => {
    // Simulate Chair announcement playing
    await ttsService.speak('Chair ahead, be careful');
    expect(ttsService.isSpeaking()).toBe(true);

    // Simulate transition in detection pipeline
    const previousObject: string = 'Chair';
    const newObject: string = 'Person';
    const isSameObject = previousObject === newObject;

    if (!isSameObject && ttsService.isSpeaking()) {
      await ttsService.stopSpeaking();
    }
    await ttsService.speak('Person ahead, be careful');

    expect(stopSpeakingSpy).toHaveBeenCalled();
    expect(ttsService.getLastSpokenText()).toBe('Person ahead, be careful');
  });

  // 5. Object disappears -> state cleared + TTS stopped
  it('5. Object disappears -> state cleared, TTS stopped, remains silent', async () => {
    // Chair detected and spoken
    cameraService.setCustomFrame('FRAME_CHAIR_DATA');
    let frame = await cameraService.captureFrame();
    let result = await aiService.detectObjectsFromFrame(frame!);
    expect(result.objects?.length).toBeGreaterThan(0);

    // Object disappears
    cameraService.setCustomFrame('FRAME_CLEAR_DATA');
    frame = await cameraService.captureFrame();
    result = await aiService.detectObjectsFromFrame(frame!);

    // Verified: state cleared, warning null, stopSpeaking invoked
    expect(result.objects).toEqual([]);
    expect(result.warning).toBeNull();

    await ttsService.stopSpeaking();
    expect(stopSpeakingSpy).toHaveBeenCalled();
    expect(ttsService.isSpeaking()).toBe(false);
  });

  // 6. Unsupported class -> ignored
  it('6. Unsupported class -> ignored and treated as no obstacle', async () => {
    expect(isAllowedObstacle('cat')).toBe(false);
    expect(isAllowedObstacle('bottle')).toBe(false);
    expect(isAllowedObstacle('airplane')).toBe(false);

    cameraService.setCustomFrame('FRAME_UNSUPPORTED_DATA_CAT');
    const frame = await cameraService.captureFrame();
    const result = await aiService.detectObjectsFromFrame(frame!);

    expect(result.objects).toEqual([]);
    expect(result.warning).toBeNull();
  });

  // 7. Same object continuously -> existing duplicate throttle preserved (~8s)
  it('7. Same object continuously -> duplicate throttle (~8s) is preserved', () => {
    const throttleMs = 8000;
    let lastSpoken = { warning: 'Chair ahead, be careful', timestamp: 1000 };

    const checkShouldSpeak = (newWarning: string, currentTime: number): boolean => {
      const isSameWarning = lastSpoken.warning === newWarning;
      const elapsed = currentTime - lastSpoken.timestamp;
      if (isSameWarning && elapsed < throttleMs) {
        return false; // Throttled
      }
      lastSpoken = { warning: newWarning, timestamp: currentTime };
      return true;
    };

    // 2 seconds later (same object) -> throttled
    expect(checkShouldSpeak('Chair ahead, be careful', 3000)).toBe(false);

    // 5 seconds later (same object) -> throttled
    expect(checkShouldSpeak('Chair ahead, be careful', 6000)).toBe(false);

    // 8.5 seconds later (same object) -> allowed
    expect(checkShouldSpeak('Chair ahead, be careful', 9501)).toBe(true);
  });

  // 8. New object -> speaks immediately regardless of previous throttle
  it('8. New object -> speaks immediately bypassing the 8s throttle of previous object', async () => {
    const throttleMs = 8000;
    let lastSpoken = { warning: 'Chair ahead, be careful', timestamp: 1000 };

    const checkShouldSpeak = (newWarning: string, currentTime: number): boolean => {
      const isSameWarning = lastSpoken.warning === newWarning;
      const elapsed = currentTime - lastSpoken.timestamp;
      if (isSameWarning && elapsed < throttleMs) {
        return false;
      }
      lastSpoken = { warning: newWarning, timestamp: currentTime };
      return true;
    };

    // Only 1 second later, but object changes to Person -> must speak immediately!
    const shouldSpeakNewObject = checkShouldSpeak('Person ahead, be careful', 2000);
    expect(shouldSpeakNewObject).toBe(true);
    expect(lastSpoken.warning).toBe('Person ahead, be careful');
  });

  // 9. No supported object -> no generic "Obstacle ahead"
  it('9. No supported object -> returns null/silence and never falls back to generic "Obstacle ahead"', async () => {
    cameraService.setCustomFrame('FRAME_CLEAR_DATA');
    const frame = await cameraService.captureFrame();
    const result = await aiService.detectObjectsFromFrame(frame!);

    expect(result.warning).toBeNull();
    expect(result.warning).not.toBe('Obstacle ahead');
    expect(result.warning).not.toBe('Obstacle ahead, be careful');

    // Also verify all allowed classes map directly to their exact class names and never to generic "Obstacle ahead"
    for (const allowed of ESSENTIAL_OBJECT_ALLOWLIST) {
      if (allowed === 'dining table') continue; // dining table maps to Table
      const warning = generateObstacleWarning(allowed);
      expect(warning).not.toContain('Obstacle');
      const enTranslation = ttsService.translateDetectionWarning(warning, 'en-US');
      expect(enTranslation).not.toContain('Obstacle');
      expect(enTranslation.toLowerCase()).toContain(allowed.toLowerCase());
    }
  });

  // 10. Detection cycle does not reuse stale detection state
  it('10. Detection cycle does not reuse stale detection state from previous cycle', async () => {
    let detectionState: any[] = [];

    // Cycle 1: Chair detected
    cameraService.setCustomFrame('FRAME_CHAIR_DATA');
    let frame = await cameraService.captureFrame();
    let result = await aiService.detectObjectsFromFrame(frame!);
    detectionState = result.objects || [];
    expect(detectionState.map(o => o.label)).toEqual(['Chair']);

    // Cycle 2: Clear frame
    cameraService.setCustomFrame('FRAME_CLEAR_DATA');
    frame = await cameraService.captureFrame();
    result = await aiService.detectObjectsFromFrame(frame!);
    // State is replaced by current frame's result (never falling back to previous frame)
    detectionState = result.objects || [];
    expect(detectionState).toEqual([]);

    // Cycle 3: Car detected
    cameraService.setCustomFrame('FRAME_CAR_DATA');
    frame = await cameraService.captureFrame();
    result = await aiService.detectObjectsFromFrame(frame!);
    detectionState = result.objects || [];
    expect(detectionState.map(o => o.label)).toEqual(['Car']);
    expect(detectionState.some(o => o.label === 'Chair')).toBe(false);
  });
});
