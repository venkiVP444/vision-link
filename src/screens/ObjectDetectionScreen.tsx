import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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

const DEBOUNCE_INTERVAL_MS = 8000;

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
  const [speaking, setSpeaking] = useState<boolean>(ttsService.isSpeaking());

  const lastSpokenRef = useRef<{ warning: string | null; timestamp: number }>({
    warning: null,
    timestamp: 0,
  });
  const isProcessingRef = useRef<boolean>(false);

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
        setWarningText(null);
        setDetectedObjects([]);
        setDisplayState('idle');
      } else if (status === 'connected') {
        // Automatically start continuous frame stream when camera is connected
        cameraService.startStream();
      }
    });

    // Auto-detect and start continuous stream if camera is attached
    cameraService.detectCamera().then((device) => {
      if (device) {
        cameraService.startStream();
      }
    });

    // Auto-load TFLite model on mount
    aiService.loadModel().catch((err) => {
      console.warn('[ObjectDetectionScreen] Pre-load model error:', err);
    });

    return () => {
      unsubTTS();
      unsubCam();
      ttsService.stopSpeaking();
      lastSpokenRef.current = { warning: null, timestamp: 0 };
    };
  }, []);

  const announceWarningWithDebounce = async (warning: string) => {
    const prefs = ttsService.getPreferences();
    if (!prefs.autoAnnounceDetections) {
      console.log('[ObjectDetectionScreen] Auto-Announce is OFF. Speech suppressed.');
      return;
    }

    if (!warning || warning.trim() === '') {
      return;
    }

    const now = Date.now();
    const last = lastSpokenRef.current;

    const isSameObject = last.warning === warning;
    const isDuplicate = isSameObject && (now - last.timestamp < DEBOUNCE_INTERVAL_MS);

    if (isDuplicate) {
      console.log('[ObjectDetectionScreen] Duplicate warning suppressed within debounce window:', warning);
      return;
    }

    // When detection changes (e.g. Chair -> Person):
    // Immediately cancel and stop any stale TTS and speak the new object.
    if (!isSameObject && ttsService.isSpeaking()) {
      console.log('[ObjectDetectionScreen] Object changed from', last.warning, 'to', warning, '- cancelling stale TTS');
      try {
        await ttsService.stopSpeaking();
      } catch (err) {
        console.warn('[ObjectDetectionScreen] Error stopping stale speech:', err);
      }
    } else if (isSameObject && ttsService.isSpeaking()) {
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
    await cameraService.connectCamera();
    await cameraService.startStream();
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
      return;
    }

    isProcessingRef.current = true;
    if (displayState === 'idle') {
      setDisplayState('capturing');
    }
    setErrorMessage(null);

    try {
      const frame = await cameraService.captureFrame();

      if (!frame) {
        setDisplayState('no-warning');
        setWarningText(null);
        setDetectedObjects([]);
        if (ttsService.isSpeaking()) {
          ttsService.stopSpeaking();
        }
        lastSpokenRef.current = { warning: null, timestamp: 0 };
        return;
      }

      if (displayState === 'idle') {
        setDisplayState('processing');
      }

      const result = await aiService.detectObjectsFromFrame(frame, 0.50);

      if (result.status === 'error') {
        setDisplayState('error');
        setErrorMessage(result.errorMessage || 'Unable to process camera frame.');
        return;
      }

      if (result.inferenceTimeMs !== undefined) {
        setLastInferenceMs(result.inferenceTimeMs);
      }
      setDetectedObjects(result.objects || []);

      if (result.warning && result.warning.trim().length > 0) {
        setDisplayState('warning');
        setWarningText(result.warning);
        setErrorMessage(null);
        const prefs = ttsService.getPreferences();
        const spokenSentence = ttsService.translateDetectionWarning(result.warning, prefs.language);
        console.log(`[EdgeAI] final warning="${result.warning}" | TTS text="${spokenSentence}"`);
        await announceWarningWithDebounce(spokenSentence);
      } else {
        setDisplayState('no-warning');
        setWarningText(null);
        setDetectedObjects([]);
        setErrorMessage(null);
        // Requirement: Clear-path logic / no sticky labels
        // When no valid allowed object is detected:
        // - Clear current detection state immediately
        // - Stay silent
        // - Stop previous TTS if speaking
        // - Reset lastSpokenRef so future reappearance is treated as a new detection
        if (ttsService.isSpeaking()) {
          ttsService.stopSpeaking();
        }
        lastSpokenRef.current = { warning: null, timestamp: 0 };
      }
    } catch (err: any) {
      console.warn('[ObjectDetectionScreen] Detection cycle error:', err);
      setDisplayState('error');
      setErrorMessage(err?.message || 'Detection failed');
    } finally {
      isProcessingRef.current = false;
    }
  };

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

      await executeDetectionCycle();

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

        {cameraStatus === 'disconnected' ? (
          <AccessibleButton
            title="Connect External Camera"
            subtitle="Connects external UVC wide-angle camera"
            accessibilityLabel="Connect external UVC camera"
            variant="primary"
            onPress={handleConnectCamera}
          />
        ) : null}
      </View>

      {/* Detection Viewport Simulation */}
      <View
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel={`Detection Viewport. Status: ${displayState}`}
        style={styles.viewport}
      >
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
        {lastInferenceMs !== null && (
          <Text style={styles.latencyBadge}>
            ⚡ Inference: {lastInferenceMs}ms on-device
          </Text>
        )}
      </View>

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
    height: 140,
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
    padding: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
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
    marginTop: 6,
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
