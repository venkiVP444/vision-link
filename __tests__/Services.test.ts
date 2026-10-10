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
      expect(result.warning).toBe('Person ahead, be careful');
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
        { frame: 'FRAME_PERSON_DATA', expectedLabel: 'Person', expectedWarning: 'Person ahead, be careful', classId: 0 },
        { frame: 'FRAME_CAR_DATA', expectedLabel: 'Car', expectedWarning: 'Car ahead, be careful', classId: 2 },
        { frame: 'FRAME_CHAIR_DATA', expectedLabel: 'Chair', expectedWarning: 'Chair ahead, be careful', classId: 61 },
        { frame: 'FRAME_MOTORCYCLE_DATA', expectedLabel: 'Motorcycle', expectedWarning: 'Motorcycle ahead, be careful', classId: 3 },
        { frame: 'FRAME_BICYCLE_DATA', expectedLabel: 'Bicycle', expectedWarning: 'Bicycle ahead, be careful', classId: 1 },
        { frame: 'FRAME_BUS_DATA', expectedLabel: 'Bus', expectedWarning: 'Bus ahead, be careful', classId: 5 },
        { frame: 'FRAME_TRUCK_DATA', expectedLabel: 'Truck', expectedWarning: 'Truck ahead, be careful', classId: 7 },
        { frame: 'FRAME_TABLE_DATA', expectedLabel: 'Table', expectedWarning: 'Table ahead, be careful', classId: 66 },
        { frame: 'FRAME_BED_DATA', expectedLabel: 'Bed', expectedWarning: 'Bed ahead, be careful', classId: 65 },
        { frame: 'FRAME_SOFA_DATA', expectedLabel: 'Sofa', expectedWarning: 'Sofa ahead, be careful', classId: 62 },
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

      // Test non-allowlisted objects (e.g. Dog, TV, Cat, Bottle): MUST be ignored, NO TTS
      const nonAllowlisted = ['FRAME_DOG_DATA', 'FRAME_TV_DATA', 'FRAME_UNSUPPORTED_CAT', 'FRAME_BOTTLE_DATA'];
      for (const rawFrame of nonAllowlisted) {
        cameraService.setCustomFrame(rawFrame);
        const nonFrame = await cameraService.captureFrame();
        const nonResult = await aiService.detectObjectsFromFrame(nonFrame!);
        expect(nonResult.status).toBe('success');
        expect(nonResult.warning).toBeNull();
        expect(nonResult.objects?.length).toBe(0);
      }

      cameraService.setCustomFrame(null);
    });
  });

  describe('Confidence Threshold Enforcement (0.75 / 75% default)', () => {
    beforeEach(() => {
      aiService.setConfidenceThreshold(0.75);
    });

    it('defaults to 0.75 (75%) confidence threshold', () => {
      expect(aiService.getConfidenceThreshold()).toBe(0.75);
    });

    it('filters detections strictly below threshold (e.g. 0.70 < 0.75), yielding no objects and no warnings', async () => {
      const result = await aiService.detectObjectsFromFrame('FRAME_PERSON_CONF_0.70', 0.75);
      expect(result.status).toBe('success');
      expect(result.objects?.length).toBe(0);
      expect(result.warning).toBeNull();
    });

    it('preserves detections equal to threshold (e.g. 0.75 == 0.75), generating object warnings and announcements', async () => {
      const result = await aiService.detectObjectsFromFrame('FRAME_PERSON_CONF_0.75', 0.75);
      expect(result.status).toBe('success');
      expect(result.objects?.length).toBe(1);
      expect(result.objects?.[0]?.confidence).toBe(0.75);
      expect(result.warning).toBe('Person ahead, be careful');
    });

    it('preserves detections above threshold (e.g. 0.90 > 0.75), generating object warnings and announcements', async () => {
      const result = await aiService.detectObjectsFromFrame('FRAME_PERSON_CONF_0.90', 0.75);
      expect(result.status).toBe('success');
      expect(result.objects?.length).toBe(1);
      expect(result.objects?.[0]?.confidence).toBe(0.90);
      expect(result.warning).toBe('Person ahead, be careful');
    });

    it('supports dynamic configurable threshold via setConfidenceThreshold', async () => {
      aiService.setConfidenceThreshold(0.85);
      expect(aiService.getConfidenceThreshold()).toBe(0.85);

      // With 0.85 threshold, a 0.80 detection is suppressed
      const belowResult = await aiService.detectObjectsFromFrame('FRAME_PERSON_CONF_0.80');
      expect(belowResult.objects?.length).toBe(0);
      expect(belowResult.warning).toBeNull();

      // With 0.85 threshold, an 0.85 detection is accepted
      const exactResult = await aiService.detectObjectsFromFrame('FRAME_PERSON_CONF_0.85');
      expect(exactResult.objects?.length).toBe(1);
      expect(exactResult.warning).toBe('Person ahead, be careful');

      // Reset to default
      aiService.setConfidenceThreshold(0.75);
      expect(aiService.getConfidenceThreshold()).toBe(0.75);
    });
  });

  describe('Offline Face Detection Pipeline (MediaPipe BlazeFace)', () => {
    beforeEach(() => {
      aiService.setFaceConfidenceThreshold(0.60);
    });

    it('defaults to 0.60 (60%) face confidence threshold', () => {
      expect(aiService.getFaceConfidenceThreshold()).toBe(0.60);
    });

    it('detects a visible face independently of person detection', async () => {
      // Frame with face only
      const faceResult = await aiService.detectFacesFromFrame('FRAME_FACE_DATA');
      expect(faceResult.status).toBe('success');
      expect(faceResult.faces.length).toBe(1);
      expect(faceResult.faces[0].confidence).toBeGreaterThanOrEqual(0.60);
      expect(faceResult.warning).toBe('Face ahead, be careful');
    });

    it('returns no-face cleanly when no face is visible', async () => {
      const result = await aiService.detectFacesFromFrame('FRAME_EMPTY_DATA');
      expect(result.status).toBe('no-face');
      expect(result.faces.length).toBe(0);
      expect(result.warning).toBeNull();
    });

    it('filters out face detections strictly below threshold (e.g. 0.50 < 0.60)', async () => {
      const result = await aiService.detectFacesFromFrame('FRAME_FACE_CONF_0.50', 0.60);
      expect(result.status).toBe('no-face');
      expect(result.faces.length).toBe(0);
      expect(result.warning).toBeNull();
    });

    it('accepts face detections meeting or exceeding threshold (e.g. 0.60 and 0.85)', async () => {
      const exactResult = await aiService.detectFacesFromFrame('FRAME_FACE_CONF_0.60', 0.60);
      expect(exactResult.status).toBe('success');
      expect(exactResult.faces.length).toBe(1);
      expect(exactResult.faces[0].confidence).toBe(0.60);

      const aboveResult = await aiService.detectFacesFromFrame('FRAME_FACE_CONF_0.85', 0.60);
      expect(aboveResult.status).toBe('success');
      expect(aboveResult.faces.length).toBe(1);
      expect(aboveResult.faces[0].confidence).toBe(0.85);
    });

    it('translates face announcements across English, Hausa, Arabic, and Hindi offline TTS', () => {
      const en = ttsService.translateDetectionWarning('Face ahead, be careful', 'en-GB');
      expect(en).toContain('Face');

      const ha = ttsService.translateDetectionWarning('Face ahead, be careful', 'ha-NG');
      expect(ha).toContain('fuska');

      const ar = ttsService.translateDetectionWarning('Face ahead, be careful', 'ar');
      expect(ar).toContain('وجه');

      const hi = ttsService.translateDetectionWarning('Face ahead, be careful', 'hi-IN');
      expect(hi).toContain('चेहरा');
    });

    it('runs face detection and person detection as completely separate results', async () => {
      // In a frame with a face but no body (e.g. close-up face), face is detected
      const faceResult = await aiService.detectFacesFromFrame('FRAME_FACE_DATA');
      expect(faceResult.status).toBe('success');
      expect(faceResult.faces.length).toBe(1);

      // Person detection with 75% threshold operates independently
      const objResult = await aiService.detectObjectsFromFrame('FRAME_PERSON_DATA', 0.75);
      expect(objResult.status).toBe('success');
      expect(objResult.objects?.[0]?.label).toBe('Person');
      expect(objResult.objects?.[0]?.confidence).toBeGreaterThanOrEqual(0.75);
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
    it('verifies relevant object allowlist contract and unsupported class documentation', () => {
      const {
        isAllowedObstacle,
        SUPPORTED_RELEVANT_OBJECT_ALLOWLIST,
        UNSUPPORTED_REQUESTED_OBJECTS,
        formatObstacleLabel,
      } = require('../src/features/ai/objectFilter');

      // 1. Supported classes
      const supported = [
        'person',
        'car',
        'truck',
        'bus',
        'motorcycle',
        'bicycle',
        'chair',
        'table',
        'dining table',
        'bed',
        'sofa',
        'couch',
      ];
      for (const item of supported) {
        expect(isAllowedObstacle(item)).toBe(true);
        expect(SUPPORTED_RELEVANT_OBJECT_ALLOWLIST).toContain(item);
      }

      // 2. Couch maps to Sofa, dining table maps to Table
      expect(formatObstacleLabel('couch')).toBe('Sofa');
      expect(formatObstacleLabel('sofa')).toBe('Sofa');
      expect(formatObstacleLabel('dining table')).toBe('Table');

      // 3. Documented unsupported classes in COCO SSD MobileNet v1
      expect(UNSUPPORTED_REQUESTED_OBJECTS).toEqual(['desk', 'door', 'wall', 'stairs']);
      for (const unsupp of UNSUPPORTED_REQUESTED_OBJECTS) {
        expect(isAllowedObstacle(unsupp)).toBe(false);
      }

      // 4. Excluded classes outside allowlist
      const excluded = ['dog', 'cat', 'tv', 'stop sign', 'fire hydrant', 'bench', 'bottle', 'laptop'];
      for (const ex of excluded) {
        expect(isAllowedObstacle(ex)).toBe(false);
      }

      // 5. Enforces 75% SSD MobileNet confidence threshold by default
      expect(aiService.getConfidenceThreshold()).toBe(0.75);

      // 6. Independent face confidence threshold preserved
      expect(aiService.getFaceConfidenceThreshold()).toBe(0.60);
    });
  });

  afterAll(async () => {
    await ttsService.stop();
    await cameraService.disconnectCamera();
    await sosService.cancelSOS();
  });
});
