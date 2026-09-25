import { cameraService } from '../src/features/camera/cameraService';
import { aiService } from '../src/features/ai/aiService';
import { apiService } from '../src/services/apiService';
import { navigationService } from '../src/features/navigation/navigationService';
import { sosService } from '../src/features/sos/sosService';
import { ttsService } from '../src/features/tts/ttsService';
import { Config } from '../src/config/environment';

describe('Vision-Link Service Layer', () => {
  describe('CameraService', () => {
    it('detects and connects mock UVC camera with realistic hardware info', async () => {
      const device = await cameraService.detectCamera();
      expect(device).not.toBeNull();
      expect(device?.isUvcCompatible).toBe(true);
      expect(device?.resolution).toBe('1920x1080 @ 30fps');

      const connected = await cameraService.connectCamera();
      expect(connected).toBe(true);
      expect(cameraService.getStatus()).toBe('connected');

      const streaming = await cameraService.startStream();
      expect(streaming).toBe(true);
      expect(cameraService.getStatus()).toBe('streaming');

      const frame = await cameraService.captureFrame();
      expect(frame).toContain('data:image/jpeg;base64');

      await cameraService.stopStream();
      expect(cameraService.getStatus()).toBe('connected');

      await cameraService.disconnectCamera();
      expect(cameraService.getStatus()).toBe('disconnected');
    });
  });

  describe('AIService & Mock Detections', () => {
    it('returns realistic mock obstacle detections including Person, Chair, Car, Bicycle, Motorcycle', () => {
      const objects = aiService.getMockDetections();
      expect(objects.length).toBeGreaterThanOrEqual(4);

      const labels = objects.map((o) => o.label);
      expect(labels).toContain('Person');
      expect(labels).toContain('Chair');
      expect(labels).toContain('Car');
      expect(labels).toContain('Bicycle');
      expect(labels).toContain('Motorcycle');

      objects.forEach((obj) => {
        expect(obj.confidence).toBeGreaterThan(0.7);
        expect(obj.boundingBox.width).toBeGreaterThan(0);
        expect(obj.boundingBox.height).toBeGreaterThan(0);
        expect(obj.distance).toBeGreaterThan(0);
      });
    });
  });

  describe('100% Offline Edge-AI Object Detection Pipeline (TFLite)', () => {
    it('performs local on-device inference without making any network requests', async () => {
      const mockFetch = jest.fn();
      (globalThis as any).fetch = mockFetch;

      const result = await aiService.detectObjectsFromFrame('BASE64_FRAME_STRING', 0.5);

      expect(result.status).toBe('success');
      expect(result.warning).toBe('Person ahead. Be careful.');
      expect(result.inferenceTimeMs).toBeGreaterThan(0);
      expect(result.model).toContain('SSD MobileNet v1');
      expect(result.objects?.length).toBeGreaterThan(0);

      // Verify ZERO network calls were made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects invalid or missing frame cleanly without crashing', async () => {
      const result = await aiService.detectObjectsFromFrame('');
      expect(result.status).toBe('error');
      expect(result.errorMessage).toBe('Invalid or missing camera frame.');
      expect(result.warning).toBeNull();
    });

    it('provides offline model metadata contract', async () => {
      const info = await aiService.getModelInfo();
      expect(info).not.toBeNull();
      expect(info?.modelName).toContain('SSD MobileNet v1');
      expect(info?.inputShape).toBe('1x300x300x3');
      expect(info?.inputDataType).toBe('UINT8');
      expect(info?.maxDetections).toBe(10);
      expect(info?.totalClasses).toBe(90);
    });

    it('dynamically processes live camera frames and announces exact allowed objects, rejecting non-allowlisted objects', async () => {
      await cameraService.connectCamera();
      const testCases: { frame: string; expectedLabel: string; expectedWarning: string; classId: number }[] = [
        { frame: 'FRAME_PERSON_DATA', expectedLabel: 'Person', expectedWarning: 'Person ahead. Be careful.', classId: 0 },
        { frame: 'FRAME_CAR_DATA', expectedLabel: 'Car', expectedWarning: 'Car ahead. Be careful.', classId: 2 },
        { frame: 'FRAME_CHAIR_DATA', expectedLabel: 'Chair', expectedWarning: 'Chair ahead. Be careful.', classId: 61 },
        { frame: 'FRAME_MOTORCYCLE_DATA', expectedLabel: 'Motorcycle', expectedWarning: 'Motorcycle ahead. Be careful.', classId: 3 },
        { frame: 'FRAME_BICYCLE_DATA', expectedLabel: 'Bicycle', expectedWarning: 'Bicycle ahead. Be careful.', classId: 1 },
        { frame: 'FRAME_BUS_DATA', expectedLabel: 'Bus', expectedWarning: 'Bus ahead. Be careful.', classId: 5 },
        { frame: 'FRAME_DOG_DATA', expectedLabel: 'Dog', expectedWarning: 'Dog ahead. Be careful.', classId: 17 },
        { frame: 'FRAME_TV_DATA', expectedLabel: 'TV', expectedWarning: 'TV ahead. Be careful.', classId: 71 },
      ];

      for (const tc of testCases) {
        cameraService.setCustomFrame(tc.frame);
        const frame = await cameraService.captureFrame();
        expect(frame).not.toBeNull();

        const result = await aiService.detectObjectsFromFrame(frame!);
        expect(result.status).toBe('success');
        expect(result.warning).toBe(tc.expectedWarning);
        expect(result.objects?.[0]?.label).toBe(tc.expectedLabel);
        expect(result.objects?.[0]?.classId).toBe(tc.classId);

        // Verify TTS translates the warning appropriately for each language
        const enTTS = ttsService.translateDetectionWarning(result.warning!, 'en-GB');
        expect(enTTS).toContain(tc.expectedLabel);

        const haTTS = ttsService.translateDetectionWarning(result.warning!, 'ha-NG');
        expect(haTTS).not.toBeNull();
        expect(haTTS).toContain('Akwai');

        const arTTS = ttsService.translateDetectionWarning(result.warning!, 'ar');
        expect(arTTS).not.toBeNull();

        const hiTTS = ttsService.translateDetectionWarning(result.warning!, 'hi-IN');
        expect(hiTTS).not.toBeNull();
        expect(hiTTS).toContain('सामने');
      }

      // Test clear path: no obstacle detected, stay silent
      cameraService.setCustomFrame('FRAME_CLEAR_EMPTY');
      const clearFrame = await cameraService.captureFrame();
      const clearResult = await aiService.detectObjectsFromFrame(clearFrame!);
      expect(clearResult.status).toBe('success');
      expect(clearResult.warning).toBeNull();
      expect(clearResult.objects?.length).toBe(0);

      // Test non-allowlisted / unsupported object (e.g. cat, bottle): MUST be ignored, NO TTS
      cameraService.setCustomFrame('FRAME_UNSUPPORTED_CAT');
      const catFrame = await cameraService.captureFrame();
      const catResult = await aiService.detectObjectsFromFrame(catFrame!);
      expect(catResult.status).toBe('success');
      expect(catResult.warning).toBeNull();
      expect(catResult.objects?.length).toBe(0);

      cameraService.setCustomFrame(null);
    });
  });

  describe('NavigationService', () => {
    it('manages walking route lifecycle and step progression', async () => {
      expect(navigationService.getStatus()).toBe('idle');

      const started = await navigationService.startNavigation('Main Lobby');
      expect(started).toBe(true);
      expect(navigationService.getStatus()).toBe('navigating');

      const step1 = navigationService.getCurrentInstruction();
      expect(step1).not.toBeNull();
      expect(step1?.distanceMeters).toBeGreaterThan(0);

      const step2 = navigationService.nextStep();
      expect(step2).not.toBeNull();

      navigationService.stopNavigation();
      expect(navigationService.getStatus()).toBe('idle');
    });
  });

  describe('SOSService', () => {
    it('executes full emergency state machine: idle -> sending -> sent -> cancelled -> idle', async () => {
      expect(sosService.getStatus()).toBe('idle');

      const contacts = await sosService.getEmergencyContacts();
      expect(contacts.length).toBeGreaterThanOrEqual(2);

      const triggerPromise = sosService.triggerSOS();
      expect(sosService.getStatus()).toBe('sending');

      await triggerPromise;
      expect(sosService.getStatus()).toBe('sent');

      await sosService.cancelSOS();
      expect(sosService.getStatus()).toBe('idle');
    });
  });

  describe('TTSService', () => {
    it('simulates text-to-speech feedback and tracks speaking state', async () => {
      expect(ttsService.isSpeaking()).toBe(false);

      await ttsService.speak('Test speech instruction');
      expect(ttsService.isSpeaking()).toBe(true);
      expect(ttsService.getLastSpokenText()).toBe('Test speech instruction');

      await ttsService.stop();
      expect(ttsService.isSpeaking()).toBe(false);

      ttsService.setPreferences({ speechRate: 1.4 });
      expect(ttsService.getPreferences().speechRate).toBe(1.4);
    });

    it('supports English and Hausa (ha-NG) speech translation for obstacle warnings', async () => {
      // Default language is English (en-GB / en-US)
      expect(['en-GB', 'en-US']).toContain(ttsService.getPreferences().language);

      const enWarning = 'Person ahead. Please be careful.';
      expect(ttsService.translateText(enWarning, 'en-GB')).toBe('Person ahead. Please be careful.');

      // Switch to Hausa (ha-NG)
      ttsService.setPreferences({ language: 'ha-NG' });
      expect(ttsService.getPreferences().language).toBe('ha-NG');

      // Verify translations for Person, Obstacle, Vehicle, and Path Clear
      expect(ttsService.translateText('Person ahead.', 'ha-NG')).toBe('Akwai mutum a gabanka, ka kula.');
      expect(ttsService.translateText('Obstacle ahead.', 'ha-NG')).toBe('Akwai cikas a gabanka, ka kula.');
      expect(ttsService.translateText('Vehicle ahead.', 'ha-NG')).toBe('Akwai mota a gabanka, ka kula.');
      expect(ttsService.translateText('Path clear. No obstacle warnings detected.', 'ha-NG')).toBe('Hanya a buɗe take, babu wani cikas.');

      await ttsService.speak(enWarning);
      expect(ttsService.getLastSpokenText()).toBe('Akwai mutum a gabanka, ka kula.');
      await ttsService.stop();

      // Verify language support check handles Hausa gracefully
      const check = ttsService.checkLanguageSupport('ha-NG');
      expect(check.supported).toBe(true);

      // Reset to English
      ttsService.setPreferences({ language: 'en-US' });
      expect(ttsService.getPreferences().language).toBe('en-US');
    });
  });

  afterAll(async () => {
    await ttsService.stop();
    await cameraService.disconnectCamera();
    await sosService.cancelSOS();
  });
});
