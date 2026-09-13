import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
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
import { CameraStatus } from '../types';

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
  const [speaking, setSpeaking] = useState<boolean>(ttsService.isSpeaking());

  const lastSpokenRef = useRef<{ warning: string | null; timestamp: number }>({
    warning: null,
    timestamp: 0,
  });

  useEffect(() => {
    const unsubTTS = ttsService.onStateChange((isSpk) => {
      console.log('[ObjectDetectionScreen] speaking changed to:', isSpk);
      setSpeaking(isSpk);
    });
    const unsubCam = cameraService.onStatusChange((status) => {
      setCameraStatus(status);
    });

    // Auto-detect camera if disconnected
    if (cameraService.getStatus() === 'disconnected') {
      cameraService.detectCamera();
    }

    return () => {
      unsubTTS();
      unsubCam();
    };
  }, []);

  const announceWarningWithDebounce = (warning: string) => {
    const now = Date.now();
    const last = lastSpokenRef.current;

    const isDuplicate =
      last.warning === warning && now - last.timestamp < DEBOUNCE_INTERVAL_MS;

    if (!isDuplicate) {
      lastSpokenRef.current = { warning, timestamp: now };
      ttsService.speak(`Warning: ${warning}`);
    }
  };

  const handleConnectCamera = async () => {
    await cameraService.connectCamera();
    await cameraService.startStream();
  };

  const runDetectionCycle = async () => {
    if (cameraStatus === 'disconnected') {
      setDisplayState('idle');
      return;
    }

    setDisplayState('capturing');
    setErrorMessage(null);

    const frame = await cameraService.captureFrame();

    if (!frame) {
      setDisplayState('error');
      setErrorMessage('Unable to capture frame from connected camera.');
      return;
    }

    setDisplayState('processing');

    const result = await aiService.detectObjectsFromFrame(frame);

    if (result.status === 'error') {
      setDisplayState('error');
      setErrorMessage(result.errorMessage || 'Unable to process image.');
      return;
    }

    if (result.warning) {
      setDisplayState('warning');
      setWarningText(result.warning);
      announceWarningWithDebounce(result.warning);
    } else {
      setDisplayState('no-warning');
      setWarningText(null);
      lastSpokenRef.current = { warning: null, timestamp: Date.now() };
    }
  };

  const handleManualAnnounce = async () => {
    console.log('[handleManualAnnounce] Tapped, displayState:', displayState, 'warningText:', warningText);
    if (displayState === 'warning' && warningText) {
      await ttsService.speak(`Obstacle warning: ${warningText}`);
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
        subtitle="Backend AI obstacle recognition & warning pipeline"
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
            ? 'PROCESSING WITH AI BACKEND'
            : 'DETECTION VIEWPORT READY'}
        </Text>
        <Text style={styles.viewportSubtitle}>
          Endpoint: POST /api/detect
        </Text>
      </View>

      {/* Active State View */}
      <View style={styles.stateContainer}>
        {displayState === 'processing' || displayState === 'capturing' ? (
          <LoadingState message="Sending camera frame to detection backend..." />
        ) : displayState === 'error' ? (
          <ErrorState
            message={errorMessage || 'Unable to complete detection request.'}
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
              No obstacle warnings returned from detection backend.
            </Text>
          </AccessibleCard>
        ) : (
          <AccessibleCard
            variant="outlined"
            accessibilityLabel="Detection idle. Tap Capture and Analyze Frame to test."
          >
            <Text style={styles.idleTitle}>Detection Idle</Text>
            <Text style={styles.idleText}>
              {cameraStatus === 'disconnected'
                ? 'Connect camera to start capturing frames.'
                : 'Tap "Capture & Analyze Frame" to send frame to backend endpoint.'}
            </Text>
          </AccessibleCard>
        )}
      </View>

      {/* Action Controls */}
      <View style={styles.controlsSection}>
        <AccessibleButton
          title="Capture & Analyze Frame"
          subtitle="Sends frame payload { image: base64 } to POST /api/detect"
          accessibilityLabel="Capture and analyze camera frame with AI backend"
          variant="primary"
          onPress={runDetectionCycle}
        />

        <AccessibleButton
          title={speaking ? 'Speaking Announcement...' : 'Announce Warning Now'}
          subtitle="Reads current obstacle warning or clear status via TTS"
          accessibilityLabel="Announce current warning status through voice"
          variant="tonal"
          onPress={handleManualAnnounce}
        />
      </View>

      {/* Backend API Integration Architecture Details */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionHeader}>API Contract & Voice Language</Text>
        <StatusCard
          label="Backend Endpoint"
          value="POST /api/detect"
          badgeText="Active Contract"
          statusType="info"
          description='Request payload: { "image": "BASE64" }\nResponses: { "status": "success", "warning": "Person ahead." }'
        />
        <StatusCard
          label="Spoken Voice Language"
          value={ttsService.getPreferences().language === 'ha-NG' ? 'Hausa (ha-NG)' : 'English (en-US)'}
          badgeText={ttsService.checkLanguageSupport(ttsService.getPreferences().language).supported ? 'Ready' : 'Fallback'}
          statusType="success"
          description={
            ttsService.getPreferences().language === 'ha-NG'
              ? 'Hausa Voice active: "Akwai mutum a gabanka, ka kula."'
              : 'English Voice active: "Person ahead. Please be careful."'
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
