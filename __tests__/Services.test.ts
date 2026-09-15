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
    it('returns realistic mock obstacle detections including Person, Chair, Door, Vehicle, Stairs', () => {
      const objects = aiService.getMockDetections();
      expect(objects.length).toBeGreaterThanOrEqual(4);

      const labels = objects.map((o) => o.label);
      expect(labels).toContain('Person');
      expect(labels).toContain('Chair');
      expect(labels).toContain('Door');
      expect(labels).toContain('Stairs');

      objects.forEach((obj) => {
        expect(obj.confidence).toBeGreaterThan(0.7);
        expect(obj.boundingBox.width).toBeGreaterThan(0);
        expect(obj.boundingBox.height).toBeGreaterThan(0);
        expect(obj.distance).toBeGreaterThan(0);
      });
    });
  });

  describe('Backend API Contract Integration (POST /api/detect)', () => {
    const originalFetch = (globalThis as any).fetch;

    beforeEach(() => {
      jest.resetAllMocks();
    });

    afterAll(() => {
      (globalThis as any).fetch = originalFetch;
    });

    it('verifies the request sends { image: "BASE64_IMAGE_STRING" } with application/json headers', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', warning: 'Person ahead.' }),
      });
      (globalThis as any).fetch = mockFetch;

      const base64Input = 'BASE64_IMAGE_STRING';
      await apiService.detectImage(base64Input);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${Config.API_BASE_URL}/api/detect`);
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      });
      expect(JSON.parse(options.body)).toEqual({
        image: 'BASE64_IMAGE_STRING',
      });
    });

    it('handles successful warning response: { status: "success", warning: "Person ahead." }', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', warning: 'Person ahead.' }),
      });

      const result = await aiService.detectObjectsFromFrame('BASE64_IMAGE_STRING');
      expect(result.status).toBe('success');
      expect(result.warning).toBe('Person ahead.');
    });

    it('handles successful no-warning response: { status: "success", warning: null }', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', warning: null }),
      });

      const result = await aiService.detectObjectsFromFrame('BASE64_IMAGE_STRING');
      expect(result.status).toBe('success');
      expect(result.warning).toBeNull();
    });

    it('handles invalid or missing image error response: { status: "error", message: "Invalid or missing image." }', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'error', message: 'Invalid or missing image.' }),
      });

      const result = await aiService.detectObjectsFromFrame('INVALID_BASE64');
      expect(result.status).toBe('error');
      expect(result.errorMessage).toBe('Invalid or missing image.');
    });

    it('handles processing/inference error response: { status: "error", message: "Unable to process image." }', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'error', message: 'Unable to process image.' }),
      });

      const result = await aiService.detectObjectsFromFrame('BASE64_CORRUPTED');
      expect(result.status).toBe('error');
      expect(result.errorMessage).toBe('Unable to process image.');
    });

    it('handles network or HTTP failures cleanly', async () => {
      (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

      const result = await aiService.detectObjectsFromFrame('BASE64_IMAGE_STRING');
      expect(result.status).toBe('error');
      expect(result.errorMessage).toBe('Network request failed');
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
