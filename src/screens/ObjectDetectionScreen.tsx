import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  AccessibleButton,
  ScreenHeader,
  AccessibleCard,
  StatusCard,
  LoadingState,
  ErrorState,
} from '../components';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { aiService } from '../features/ai/aiService';
import { cameraService } from '../features/camera/cameraService';
import { ttsService } from '../features/tts/ttsService';
import { CameraStatus, DetectedObject } from '../types';

type DetectionDisplayState =
  | 'idle'
  | 'capturing'
  | 'processing'
  | 'warning'
  | 'no-warning'
  | 'error';

export const DEFAULT_OBJECT_DEBOUNCE_CONFIG = {
  // If the same object remains continuously detected, wait at least this long before repeating
  continuousCooldownMs: 12000,
  // If an object is absent/unseen for this long, it is considered to have disappeared;
  // when seen again, it will be announced immediately with zero latency.
  disappearanceWindowMs: 2500,
  // Number of consecutive valid inference frames without obstacles required before certifying path is clear
  clearPathConsecutiveFrames: 2,
};

interface ObjectTrackState {
  lastAnnouncedTimestamp: number;
  lastSeenTimestamp: number;
  isAnnounced: boolean;
}

export const ObjectDetectionScreen: React.FC = () => {
  const navigation = useNavigation();
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>(
    cameraService.getStatus()
  );
  const [displayState, setDisplayState] = useState<DetectionDisplayState>('idle');
  const [warningText, setWarningText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [lastInferenceMs, setLastInferenceMs] = useState<number | null>(null);
  const [_speaking, setSpeaking] = useState<boolean>(ttsService.isSpeaking());
  const [currentFrameUri, setCurrentFrameUri] = useState<string | null>(null);

  const lastSpokenRef = useRef<{ warning: string | null; timestamp: number }>({
    warning: null,
    timestamp: 0,
  });
  const lastFaceSpokenRef = useRef<{ warning: string | null; timestamp: number }>({
    warning: null,
    timestamp: 0,
  });
  const objectTrackMapRef = useRef<Map<string, ObjectTrackState>>(new Map());
  const consecutiveClearFramesRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const isFaceProcessingRef = useRef<boolean>(false);
  const prevCamStatusRef = useRef<CameraStatus>(cameraService.getStatus());
  const executeDetectionCycleRef = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    const unsubTTS = ttsService.onStateChange((isSpk) => {
      setSpeaking(isSpk);
    });
    const unsubCam = cameraService.onStatusChange((status) => {
      setCameraStatus(status);
      if (status === 'disconnected') {
        // Requirement 7: When camera disconnects:
        // - Immediately stop inference
        // - Stop camera frame processing
        // - Clear current detection state
        // - Stop/cancel currently playing TTS
        // - Clear queued/stale announcements
        ttsService.stopSpeaking();
        lastSpokenRef.current = { warning: null, timestamp: 0 };
        lastFaceSpokenRef.current = { warning: null, timestamp: 0 };
        objectTrackMapRef.current.clear();
        consecutiveClearFramesRef.current = 0;
        isFaceProcessingRef.current = false;
        setCurrentFrameUri(null);
        setWarningText(null);
        setDetectedObjects([]);
        setDisplayState('idle');
        prevCamStatusRef.current = 'disconnected';
      } else if (status === 'connected') {
        // Automatically start continuous frame stream when camera is connected
        cameraService.startStream();
        if (prevCamStatusRef.current !== 'connected') {
          prevCamStatusRef.current = 'connected';
          console.log('[ObjectDetectionScreen] Camera connected, announcing status...');
          ttsService.speak('OTG camera connected successfully.').catch((err) => {
            console.warn('[ObjectDetectionScreen] Camera connection announcement error:', err);
          });
        }
      } else if (status === 'streaming') {
        prevCamStatusRef.current = 'streaming';
      }
    });

    // Ensure camera permission is granted and auto-detect camera
    cameraService.requestCameraPermission().then((granted) => {
      if (granted) {
        cameraService.detectCamera().then((device) => {
          if (device) {
            cameraService.startStream();
          }
        });
      }
    });

    // Auto-load TFLite model on mount
    aiService.loadModel().catch((err) => {
      console.warn('[ObjectDetectionScreen] Pre-load model error:', err);
    });

    const currentTrackMap = objectTrackMapRef.current;

    return () => {
      unsubTTS();
      unsubCam();
      ttsService.stopSpeaking();
      lastSpokenRef.current = { warning: null, timestamp: 0 };
      lastFaceSpokenRef.current = { warning: null, timestamp: 0 };
      currentTrackMap.clear();
      consecutiveClearFramesRef.current = 0;
      isFaceProcessingRef.current = false;
    };
  }, []);

  const announceWarningWithDebounce = async (warning: string, objectLabel?: string) => {
    const prefs = ttsService.getPreferences();
    if (!prefs.autoAnnounceDetections) {
      console.log('[ObjectDetectionScreen] Auto-Announce is OFF. Speech suppressed.');
      return;
    }

    if (!warning || warning.trim() === '') {
      return;
    }

    const now = Date.now();
    const key = (objectLabel || warning).toLowerCase().trim();
    const track = objectTrackMapRef.current.get(key);

    const hasDisappeared = !track || (now - track.lastSeenTimestamp > DEFAULT_OBJECT_DEBOUNCE_CONFIG.disappearanceWindowMs);
    const continuousElapsed = track ? (now - track.lastAnnouncedTimestamp) : Infinity;

    // Check if announcement should occur for this object:
    // 1. Newly detected or reappeared after disappearance window: announce immediately with zero latency.
    // 2. Continuously detected: suppress repeated announcements until continuousCooldownMs has elapsed.
    const shouldAnnounce = hasDisappeared || (continuousElapsed >= DEFAULT_OBJECT_DEBOUNCE_CONFIG.continuousCooldownMs);

    // Update track record
    objectTrackMapRef.current.set(key, {
      lastAnnouncedTimestamp: shouldAnnounce ? now : (track ? track.lastAnnouncedTimestamp : now),
      lastSeenTimestamp: now,
      isAnnounced: shouldAnnounce ? true : (track ? track.isAnnounced : true),
    });

    if (!shouldAnnounce) {
      console.log(`[ObjectDetectionScreen] Debounced repeated announcement for "${key}" (cooldown remaining: ${Math.max(0, DEFAULT_OBJECT_DEBOUNCE_CONFIG.continuousCooldownMs - continuousElapsed)}ms)`);
      return;
    }

    const last = lastSpokenRef.current;
    const isSameWarning = last.warning === warning;

    // When detection changes (e.g. Chair -> Person):
    // Immediately cancel and stop any stale TTS and speak the new object.
    if (!isSameWarning && ttsService.isSpeaking()) {
      console.log('[ObjectDetectionScreen] Object changed from', last.warning, 'to', warning, '- cancelling stale TTS');
      try {
        await ttsService.stopSpeaking();
      } catch (err) {
        console.warn('[ObjectDetectionScreen] Error stopping stale speech:', err);
      }
    } else if (isSameWarning && ttsService.isSpeaking()) {
      console.log('[ObjectDetectionScreen] TTS is currently speaking same warning. Avoiding overlapping audio.');
      return;
    }

    lastSpokenRef.current = { warning, timestamp: now };
    console.log('[EdgeAI] TTS announcement started:', warning);
    ttsService.speak(warning).catch((err) => {
      console.error('[ObjectDetectionScreen] Automatic TTS announcement failed:', err);
    });
  };

  const handleConnectCamera = async () => {
    const granted = await cameraService.requestCameraPermission();
    if (granted) {
      const connected = await cameraService.connectCamera();
      if (connected) {
        await cameraService.startStream();
      }
    }
  };

  const runIndependentFaceDetection = async (framePayload: any) => {
    if (isFaceProcessingRef.current) return;
    isFaceProcessingRef.current = true;
    try {
      const faceResult = await aiService.detectFacesFromFrame(framePayload);
      if (faceResult.status === 'success' && faceResult.faces.length > 0) {
        const now = Date.now();
        const faceWarning = faceResult.warning || 'Face ahead, be careful';
        const isSameWarning = lastFaceSpokenRef.current.warning === faceWarning;
        const cooldownElapsed = now - lastFaceSpokenRef.current.timestamp > 10000;

        // Announce when face appears OR after 10s cooldown for continuously visible face
        if (!isSameWarning || cooldownElapsed) {
          lastFaceSpokenRef.current = { warning: faceWarning, timestamp: now };
          const prefs = ttsService.getPreferences();
          if (prefs.autoAnnounceDetections && !ttsService.isSpeaking()) {
            const spokenFace = ttsService.translateDetectionWarning(faceWarning, prefs.language);
            console.log(`[OfflineFaceAI] Spoken face announcement: "${spokenFace}"`);
            await ttsService.speak(spokenFace);
          }
        }
      } else if (faceResult.status === 'no-face') {
        // Face is no longer in view; reset so reappearance triggers immediate announcement
        lastFaceSpokenRef.current = { warning: null, timestamp: 0 };
      }
    } catch (faceErr) {
      console.warn('[OfflineFaceAI] Face detection cycle warning:', faceErr);
    } finally {
      isFaceProcessingRef.current = false;
    }
  };

  const executeDetectionCycle = async () => {
    if (isProcessingRef.current) {
      return;
    }

    const currentStatus = cameraService.getStatus();
    if (currentStatus === 'disconnected') {
      setDisplayState('idle');
      setWarningText(null);
      setDetectedObjects([]);
      ttsService.stopSpeaking();
      lastSpokenRef.current = { warning: null, timestamp: 0 };
      objectTrackMapRef.current.clear();
      consecutiveClearFramesRef.current = 0;
      return;
    }

    isProcessingRef.current = true;
    setErrorMessage(null);

    try {
      const frame = await cameraService.captureFrame();

      if (!frame) {
        // Missing frame: treat as unknown, reset consecutive clear frame counter, do not assume path is clear
        consecutiveClearFramesRef.current = 0;
        if (displayState === 'processing' || displayState === 'capturing') {
          setDisplayState('idle');
        }
        return;
      }

      const frameUri = typeof frame === 'string' ? frame : frame.data;
      if (frameUri) {
        setCurrentFrameUri(frameUri);
      }

      if (displayState === 'idle') {
        setDisplayState('processing');
      }

      const result = await aiService.detectObjectsFromFrame(frame, aiService.getConfidenceThreshold());

      if (result.status === 'error') {
        consecutiveClearFramesRef.current = 0;
        setDisplayState('error');
        setErrorMessage(result.errorMessage || 'Unable to process camera frame.');
        return;
      }

      if (result.inferenceTimeMs !== undefined) {
        setLastInferenceMs(result.inferenceTimeMs);
      }
      setDetectedObjects(result.objects || []);

      // Trigger independent face detection safely on the frame
      runIndependentFaceDetection(frame);

      if (result.warning && result.warning.trim().length > 0 && result.objects && result.objects.length > 0) {
        consecutiveClearFramesRef.current = 0;
        setDisplayState('warning');
        setWarningText(result.warning);
        setErrorMessage(null);
        const prefs = ttsService.getPreferences();
        const spokenSentence = ttsService.translateDetectionWarning(result.warning, prefs.language);
        const primaryLabel = result.objects[0]?.label || undefined;
        console.log(`[EdgeAI] final warning="${result.warning}" | TTS text="${spokenSentence}"`);
        await announceWarningWithDebounce(spokenSentence, primaryLabel);
      } else {
        // Valid inference frame with NO qualifying obstacles
        consecutiveClearFramesRef.current += 1;

        // Prune or reset disappeared objects from track map
        const now = Date.now();
        objectTrackMapRef.current.forEach((track) => {
          if (now - track.lastSeenTimestamp > DEFAULT_OBJECT_DEBOUNCE_CONFIG.disappearanceWindowMs) {
            track.isAnnounced = false;
          }
        });

        // Require multiple consecutive valid frames before declaring path clear
        if (consecutiveClearFramesRef.current >= DEFAULT_OBJECT_DEBOUNCE_CONFIG.clearPathConsecutiveFrames) {
          setDisplayState('no-warning');
          setWarningText(null);
          setDetectedObjects([]);
          setErrorMessage(null);
          // Default to silence when path is clear (maintain quiet mode; only manual announce speaks)
          if (ttsService.isSpeaking()) {
            ttsService.stopSpeaking();
          }
          lastSpokenRef.current = { warning: null, timestamp: 0 };
        }
      }
    } catch (err: any) {
      consecutiveClearFramesRef.current = 0;
      console.warn('[ObjectDetectionScreen] Detection cycle error:', err);
      setDisplayState('error');
      setErrorMessage(err?.message || 'Detection failed');
    } finally {
      isProcessingRef.current = false;
    }
  };

  executeDetectionCycleRef.current = executeDetectionCycle;

  // Automated continuous hands-free detection loop
  useEffect(() => {
    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const runLoop = async () => {
      if (!isMounted) return;
      const status = cameraService.getStatus();
      if (status !== 'connected' && status !== 'streaming') {
        return;
      }

      await executeDetectionCycleRef.current();

      if (isMounted) {
        timerId = setTimeout(runLoop, 350);
      }
    };

    if (cameraStatus === 'connected' || cameraStatus === 'streaming') {
      runLoop();
    }

    return () => {
      isMounted = false;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [cameraStatus]);

  const runDetectionCycle = async () => {
    await executeDetectionCycle();
  };

  const handleManualAnnounce = async () => {
    console.log('[handleManualAnnounce] Tapped, displayState:', displayState, 'warningText:', warningText);
    const prefs = ttsService.getPreferences();
    if (displayState === 'warning' && warningText) {
      const spokenSentence = ttsService.translateDetectionWarning(warningText, prefs.language);
      await ttsService.speak(spokenSentence);
    } else if (displayState === 'no-warning') {
      await ttsService.speak('Path clear. No obstacle warnings detected.');
    } else if (cameraStatus === 'disconnected') {
      await ttsService.speak('Camera not connected. Connect external UVC camera to analyze path.');
    } else {
      await ttsService.speak('No current obstacle analysis available.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader
        screenTitle="Object Detection"
        subtitle="100% Offline Edge-AI obstacle recognition & warning pipeline"
        onBackPress={() => navigation.goBack()}
      />

      {/* Camera Connection Status Banner */}
      <View style={styles.cameraStatusCard}>
        <View style={styles.statusHeaderRow}>
          <Text style={styles.cameraStatusLabel}>CAMERA STATUS</Text>
          <View
            style={[
              styles.statusBadge,
              cameraStatus === 'connected' || cameraStatus === 'streaming'
                ? styles.badgeConnected
                : styles.badgeDisconnected,
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {cameraStatus.toUpperCase()}
            </Text>
          </View>
        </View>

        {cameraStatus !== 'connected' && cameraStatus !== 'streaming' ? (
          <AccessibleButton
            title="Connect External Camera"
            subtitle="Connects external UVC wide-angle camera"
            accessibilityLabel="Connect external UVC camera"
            variant="primary"
            onPress={handleConnectCamera}
          />
        ) : null}
      </View>

      {/* Real-time UVC Camera Viewport */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleManualAnnounce}
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel={`Detection Viewport. Status: ${displayState}. Tap to hear audio announcement.`}
        accessibilityHint="Tap to hear current obstacle analysis"
        style={styles.viewport}
      >
        {currentFrameUri && (cameraStatus === 'connected' || cameraStatus === 'streaming') ? (
          <Image
            source={{ uri: currentFrameUri }}
            style={styles.viewportImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.viewportPlaceholder}>
            <Text style={styles.viewportTitle}>
              {cameraStatus === 'disconnected'
                ? 'CAMERA DISCONNECTED'
                : displayState === 'capturing'
                ? 'CAPTURING CAMERA FRAME'
                : displayState === 'processing'
                ? 'RUNNING ON-DEVICE INFERENCE'
                : 'EDGE-AI VIEWPORT READY'}
            </Text>
            <Text style={styles.viewportSubtitle}>
              Engine: TFLite (100% Offline • SSD MobileNet v1)
            </Text>
          </View>
        )}

        <View style={styles.viewportOverlay}>
          <View style={styles.viewportBadgeRow}>
            <View style={styles.liveBadge}>
              <View
                style={[
                  styles.liveDot,
                  (cameraStatus === 'connected' || cameraStatus === 'streaming') && styles.liveDotActive,
                ]}
              />
              <Text style={styles.liveText}>
                {cameraStatus === 'streaming' ? 'UVC LIVE' : cameraStatus.toUpperCase()}
              </Text>
            </View>
            {lastInferenceMs !== null && (
              <Text style={styles.latencyBadge}>
                ⚡ {lastInferenceMs}ms on-device
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Active State View */}
      <View style={styles.stateContainer}>
        {displayState === 'processing' || displayState === 'capturing' ? (
          <LoadingState message="Running on-device TFLite inference..." />
        ) : displayState === 'error' ? (
          <ErrorState
            message={errorMessage || 'Unable to complete detection.'}
            onRetry={runDetectionCycle}
          />
        ) : displayState === 'warning' && warningText ? (
          <AccessibleCard
            variant="elevated"
            style={styles.warningCard}
            accessibilityLabel={`Warning detected: ${warningText}`}
          >
            <View style={styles.warningHeaderRow}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningTitle}>OBSTACLE DETECTED</Text>
            </View>
            <Text style={styles.warningText}>{warningText}</Text>
            {detectedObjects.length > 0 && (
              <View style={styles.objectsDetailRow}>
                {detectedObjects.map((obj, idx) => (
                  <View key={idx} style={styles.objectChip}>
                    <Text style={styles.objectChipText}>
                      {obj.label} ({Math.round(obj.confidence * 100)}% • {obj.position || 'ahead'})
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </AccessibleCard>
        ) : displayState === 'no-warning' ? (
          <AccessibleCard
            variant="outlined"
            style={styles.noWarningCard}
            accessibilityLabel="Path clear. No obstacle warning detected."
          >
            <View style={styles.warningHeaderRow}>
              <Text style={styles.clearIcon}>✅</Text>
              <Text style={styles.clearTitle}>PATH CLEAR</Text>
            </View>
            <Text style={styles.clearText}>
              No obstacle warnings detected above confidence threshold.
            </Text>
          </AccessibleCard>
        ) : (
          <AccessibleCard
            variant="outlined"
            accessibilityLabel="Continuous detection ready."
          >
            <Text style={styles.idleTitle}>
              {cameraStatus === 'disconnected'
                ? 'Camera Disconnected'
                : 'Continuous Detection Active'}
            </Text>
            <Text style={styles.idleText}>
              {cameraStatus === 'disconnected'
                ? 'Connect external UVC camera to start automatic real-time obstacle detection.'
                : 'Live continuous camera frames are streaming to on-device TFLite inference.'}
            </Text>
          </AccessibleCard>
        )}
      </View>

      {/* Action Controls */}
      {cameraStatus === 'disconnected' && (
        <View style={styles.controlsSection}>
          <AccessibleButton
            title="Connect External Camera"
            subtitle="Connects external UVC wide-angle camera"
            accessibilityLabel="Connect external UVC camera"
            variant="primary"
            onPress={handleConnectCamera}
          />
        </View>
      )}

      {/* Architecture & Voice Language Details */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionHeader}>Offline Pipeline & Spoken Voice</Text>
        <StatusCard
          label="Edge-AI Detection Engine"
          value="SSD MobileNet v1 (4.2 MB)"
          badgeText="100% Offline"
          statusType="success"
          description="Runs on-device CPU via TensorFlow Lite. No internet required, no cloud latency, works in Airplane Mode."
        />
        <StatusCard
          label="Auto-Announce Status"
          value={ttsService.getPreferences().autoAnnounceDetections ? 'Auto-Announce Active' : 'Auto-Announce Disabled'}
          badgeText={ttsService.getPreferences().autoAnnounceDetections ? 'Hands-Free ON' : 'Hands-Free OFF'}
          statusType={ttsService.getPreferences().autoAnnounceDetections ? 'success' : 'neutral'}
          description={
            ttsService.getPreferences().autoAnnounceDetections
              ? 'Detected obstacles are spoken automatically via offline neural TTS with 8s duplicate throttling.'
              : 'Obstacle voice announcements are muted. Enable in Settings for automatic speech.'
          }
        />
        <StatusCard
          label="Spoken Voice Language"
          value={
            ttsService.getPreferences().language === 'ha-NG'
              ? 'Hausa (ha-NG)'
              : ttsService.getPreferences().language === 'en-GB'
              ? 'English UK (en-GB)'
              : ttsService.getPreferences().language === 'ar'
              ? 'Arabic (ar)'
              : ttsService.getPreferences().language === 'hi-IN'
              ? 'Hindi (hi-IN)'
              : 'English US (en-US)'
          }
          badgeText={ttsService.checkLanguageSupport(ttsService.getPreferences().language).supported ? 'Ready' : 'Not Supported'}
          statusType={ttsService.checkLanguageSupport(ttsService.getPreferences().language).supported ? 'success' : 'warning'}
          description={
            ttsService.getPreferences().language === 'ha-NG'
              ? 'Hausa Voice active: "Akwai mutum a gabanka, ka kula."'
              : ttsService.getPreferences().language === 'en-GB'
              ? 'English UK active: "Person ahead. Please be careful."'
              : ttsService.getPreferences().language === 'ar'
              ? 'Arabic Voice: "يوجد شخص أمامك. يرجى توخي الحذر."'
              : ttsService.getPreferences().language === 'hi-IN'
              ? 'Hindi Voice: "सामने व्यक्ति है। कृपया सावधान रहें।"'
              : 'English US active: "Person ahead. Please be careful."'
          }
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    flexGrow: 1,
  },
  cameraStatusCard: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  cameraStatusLabel: {
    ...Typography.labelMedium,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeConnected: {
    backgroundColor: Colors.secondaryContainer,
  },
  badgeDisconnected: {
    backgroundColor: Colors.errorContainer,
  },
  statusBadgeText: {
    ...Typography.labelMedium,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.onSurface,
  },
  viewport: {
    height: 190,
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.md,
  },
  viewportImage: {
    width: '100%',
    height: '100%',
  },
  viewportPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  viewportOverlay: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    right: Spacing.sm,
  },
  viewportBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
    marginRight: 6,
  },
  liveDotActive: {
    backgroundColor: '#10B981',
  },
  liveText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  viewportTitle: {
    ...Typography.labelLarge,
    color: '#38BDF8',
    letterSpacing: 1,
    textAlign: 'center',
  },
  viewportSubtitle: {
    ...Typography.bodyMedium,
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 4,
  },
  latencyBadge: {
    ...Typography.labelMedium,
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  stateContainer: {
    marginBottom: Spacing.md,
  },
  warningCard: {
    backgroundColor: Colors.warningContainer,
    borderColor: Colors.onWarningContainer,
    borderWidth: 1,
  },
  warningHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  warningIcon: {
    fontSize: 22,
    marginRight: Spacing.xs,
  },
  warningTitle: {
    ...Typography.titleMedium,
    color: Colors.onWarningContainer,
    fontWeight: '800',
  },
  warningText: {
    ...Typography.bodyLarge,
    color: Colors.onWarningContainer,
    fontWeight: '600',
    marginTop: 4,
  },
  objectsDetailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
  },
  objectChip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D97706',
  },
  objectChipText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '700',
  },
  noWarningCard: {
    backgroundColor: Colors.surface,
  },
  clearIcon: {
    fontSize: 22,
    marginRight: Spacing.xs,
  },
  clearTitle: {
    ...Typography.titleMedium,
    color: Colors.primary,
    fontWeight: '800',
  },
  clearText: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
  },
  idleTitle: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
  },
  idleText: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
  },
  controlsSection: {
    marginBottom: Spacing.md,
  },
  infoSection: {
    marginTop: Spacing.md,
  },
  sectionHeader: {
    ...Typography.titleMedium,
    color: Colors.onBackground,
    marginBottom: Spacing.xs,
  },
});

export default ObjectDetectionScreen;
