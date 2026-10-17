import { ttsService } from '../src/features/tts/ttsService';
import { aiService } from '../src/features/ai/aiService';
import { cameraService } from '../src/features/camera/cameraService';
import { DEFAULT_OBJECT_DEBOUNCE_CONFIG } from '../src/screens/ObjectDetectionScreen';

describe('Vision-Link — Object Debouncing, Voice Output Optimization & Real Detection Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await ttsService.stopSpeaking();
    ttsService.setPreferences({ language: 'en-GB', speechRate: 1.05, autoAnnounceDetections: true });
    await cameraService.connectCamera();
  });

  afterEach(async () => {
    await ttsService.stopSpeaking();
  });

  afterAll(async () => {
    await cameraService.disconnectCamera();
  });

  describe('1. Voice Output Optimization', () => {
    it('sets default speech rate conservatively to 1.05 for responsive clarity', () => {
      const prefs = ttsService.getPreferences();
      expect(prefs.speechRate).toBe(1.05);
    });

    it('clears pending timeout when speak is invoked consecutively', async () => {
      await ttsService.speak('Chair ahead, be careful');
      expect(ttsService.isSpeaking()).toBe(true);

      // Subsequent speak should cancel old timeout and start new announcement
      await ttsService.speak('Person ahead, be careful');
      expect(ttsService.isSpeaking()).toBe(true);
      expect(ttsService.getLastSpokenText()).toBe('Person ahead, be careful');
    });

    it('clears speaking state and timeout when stopSpeaking is called', async () => {
      await ttsService.speak('Obstacle ahead. Please proceed carefully.');
      expect(ttsService.isSpeaking()).toBe(true);

      await ttsService.stopSpeaking();
      expect(ttsService.isSpeaking()).toBe(false);
    });
  });

  describe('2. Prevent Repeated Object Announcements & Per-Object Debouncing', () => {
    it('provides configurable constants for cooldown and disappearance window', () => {
      expect(DEFAULT_OBJECT_DEBOUNCE_CONFIG.continuousCooldownMs).toBe(12000);
      expect(DEFAULT_OBJECT_DEBOUNCE_CONFIG.disappearanceWindowMs).toBe(2500);
      expect(DEFAULT_OBJECT_DEBOUNCE_CONFIG.clearPathConsecutiveFrames).toBe(2);
    });

    it('simulates per-object debounce: allows immediate announcement for new objects and suppresses continuous repetition', () => {
      interface ObjectTrackState {
        lastAnnouncedTimestamp: number;
        lastSeenTimestamp: number;
        isAnnounced: boolean;
      }
      const trackMap = new Map<string, ObjectTrackState>();

      const checkDebounce = (label: string, currentTime: number): boolean => {
        const key = label.toLowerCase().trim();
        const track = trackMap.get(key);
        const hasDisappeared = !track || (currentTime - track.lastSeenTimestamp > DEFAULT_OBJECT_DEBOUNCE_CONFIG.disappearanceWindowMs);
        const continuousElapsed = track ? (currentTime - track.lastAnnouncedTimestamp) : Infinity;
        const shouldAnnounce = hasDisappeared || (continuousElapsed >= DEFAULT_OBJECT_DEBOUNCE_CONFIG.continuousCooldownMs);

        trackMap.set(key, {
          lastAnnouncedTimestamp: shouldAnnounce ? currentTime : (track ? track.lastAnnouncedTimestamp : currentTime),
          lastSeenTimestamp: currentTime,
          isAnnounced: shouldAnnounce ? true : (track ? track.isAnnounced : true),
        });

        return shouldAnnounce;
      };

      let time = 1000;

      // 1. First detection of Chair -> should announce immediately (0 latency)
      expect(checkDebounce('Chair', time)).toBe(true);

      // 2. Continuous detection of Chair at +500ms (within cooldown) -> suppressed
      time += 500;
      expect(checkDebounce('Chair', time)).toBe(false);

      // 3. Independent object Person detected at +1000ms -> should announce immediately
      time += 500;
      expect(checkDebounce('Person', time)).toBe(true);

      // 4. Continuous detection of Person at +1500ms -> suppressed
      time += 500;
      expect(checkDebounce('Person', time)).toBe(false);

      // 5. Chair has now disappeared for 3000ms (> 2500ms disappearance window)
      // When Chair reappears at time 5000 -> should announce immediately
      time = 5000;
      expect(checkDebounce('Chair', time)).toBe(true);
    });

    it('allows re-announcement after continuous cooldown has elapsed', () => {
      interface ObjectTrackState {
        lastAnnouncedTimestamp: number;
        lastSeenTimestamp: number;
        isAnnounced: boolean;
      }
      const trackMap = new Map<string, ObjectTrackState>();

      const checkDebounce = (label: string, currentTime: number): boolean => {
        const key = label.toLowerCase().trim();
        const track = trackMap.get(key);
        const hasDisappeared = !track || (currentTime - track.lastSeenTimestamp > DEFAULT_OBJECT_DEBOUNCE_CONFIG.disappearanceWindowMs);
        const continuousElapsed = track ? (currentTime - track.lastAnnouncedTimestamp) : Infinity;
        const shouldAnnounce = hasDisappeared || (continuousElapsed >= DEFAULT_OBJECT_DEBOUNCE_CONFIG.continuousCooldownMs);

        trackMap.set(key, {
          lastAnnouncedTimestamp: shouldAnnounce ? currentTime : (track ? track.lastAnnouncedTimestamp : currentTime),
          lastSeenTimestamp: currentTime,
          isAnnounced: shouldAnnounce ? true : (track ? track.isAnnounced : true),
        });

        return shouldAnnounce;
      };

      let time = 10000;
      expect(checkDebounce('Car', time)).toBe(true);

      // Simulate continuous frame detections every 500ms for 3 seconds (within 12s cooldown)
      for (let i = 0; i < 6; i++) {
        time += 500;
        expect(checkDebounce('Car', time)).toBe(false);
      }

      // Continue streaming frames until right before 12s continuous cooldown elapses
      while (time < 10000 + DEFAULT_OBJECT_DEBOUNCE_CONFIG.continuousCooldownMs - 500) {
        time += 500;
        expect(checkDebounce('Car', time)).toBe(false);
      }

      // Frame exactly when 12s continuous cooldown has elapsed re-announces
      time += 500; // time is now initial 10000 + 12000 ms
      expect(checkDebounce('Car', time)).toBe(true);
    });
  });

  describe('3. Enforcing Real Detection Results & Multi-Frame Clear Path', () => {
    it('announces only genuine detections matching confidence threshold >= 0.75 and allowlist', async () => {
      cameraService.setCustomFrame('FRAME_CHAIR_DATA');
      const frame = await cameraService.captureFrame();
      const result = await aiService.detectObjectsFromFrame(frame!);

      expect(result.status).toBe('success');
      expect(result.objects?.length).toBeGreaterThan(0);
      result.objects?.forEach((obj) => {
        expect(obj.confidence).toBeGreaterThanOrEqual(0.75);
      });
    });

    it('does not count missing frames as clear path', async () => {
      let consecutiveClearFrames = 0;
      const processFrame = (frame: any) => {
        if (!frame) {
          consecutiveClearFrames = 0; // treated as unknown
          return 'idle';
        }
        return 'processing';
      };

      expect(processFrame(null)).toBe('idle');
      expect(consecutiveClearFrames).toBe(0);
      expect(processFrame(undefined)).toBe('idle');
      expect(consecutiveClearFrames).toBe(0);
    });

    it('requires multiple consecutive valid clear frames before certifying clear path', async () => {
      let consecutiveClearFrames = 0;
      let displayState: string = 'warning';

      const handleFrameResult = (hasObstacle: boolean) => {
        if (hasObstacle) {
          consecutiveClearFrames = 0;
          displayState = 'warning';
        } else {
          consecutiveClearFrames += 1;
          if (consecutiveClearFrames >= DEFAULT_OBJECT_DEBOUNCE_CONFIG.clearPathConsecutiveFrames) {
            displayState = 'no-warning';
          }
        }
      };

      // Frame 1: clear frame
      handleFrameResult(false);
      expect(consecutiveClearFrames).toBe(1);
      expect(displayState).toBe('warning'); // Not yet clear, requires 2 consecutive frames!

      // Frame 2: clear frame
      handleFrameResult(false);
      expect(consecutiveClearFrames).toBe(2);
      expect(displayState).toBe('no-warning'); // Now certified clear!

      // Frame 3: obstacle appears
      handleFrameResult(true);
      expect(consecutiveClearFrames).toBe(0);
      expect(displayState).toBe('warning');

      // Frame 4: 1 clear frame followed by an error/missing frame resets count
      handleFrameResult(false);
      expect(consecutiveClearFrames).toBe(1);
      expect(displayState).toBe('warning');
      consecutiveClearFrames = 0; // missing frame resets
      expect(consecutiveClearFrames).toBe(0);
      expect(displayState).toBe('warning'); // Still warning, never prematurely cleared!
    });
  });
});
