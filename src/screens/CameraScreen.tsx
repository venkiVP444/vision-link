import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  AccessibleButton,
  ScreenHeader,
  AccessibleCard,
  StatusCard,
} from '../components';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { cameraService } from '../features/camera/cameraService';
import { ttsService } from '../features/tts/ttsService';
import { CameraDeviceInfo, CameraStatus } from '../types';

export const CameraScreen: React.FC = () => {
  const navigation = useNavigation();
  const [status, setStatus] = useState<CameraStatus>(cameraService.getStatus());
  const [deviceInfo, setDeviceInfo] = useState<CameraDeviceInfo | null>(
    cameraService.getDeviceInfo()
  );
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const unsub = cameraService.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setDeviceInfo(cameraService.getDeviceInfo());
    });

    return () => {
      unsub();
    };
  }, []);

  const handleConnectCamera = async () => {
    setLoading(true);
    await ttsService.speak('Connecting to external UVC camera.');
    await cameraService.connectCamera();
    setLoading(false);
    await ttsService.speak('External camera connected successfully.');
  };

  const handleDisconnectCamera = async () => {
    await cameraService.disconnectCamera();
    await ttsService.speak('External camera disconnected.');
  };

  const handleToggleStream = async () => {
    if (status === 'streaming') {
      await cameraService.stopStream();
      await ttsService.speak('Camera stream paused.');
    } else {
      await cameraService.startStream();
      await ttsService.speak('Live video streaming active.');
    }
  };

  const isConnected = status === 'connected' || status === 'streaming';
  const isStreaming = status === 'streaming';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader
        screenTitle="External Camera"
        subtitle="USB OTG UVC hardware lifecycle & feed"
        onBackPress={() => navigation.goBack()}
      />

      {/* Simulated Viewfinder / Video Stream Area */}
      <View
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel={`Camera viewfinder viewport. Current stream status is ${status}.`}
        style={[
          styles.viewfinder,
          isStreaming ? styles.viewfinderStreaming : styles.viewfinderIdle,
        ]}
      >
        <View style={styles.viewfinderCrosshair}>
          <Text style={styles.viewfinderText}>
            {isStreaming
              ? 'LIVE UVC FEED ACTIVE (1080p)'
              : 'CAMERA STANDBY / DISCONNECTED'}
          </Text>
          <Text style={styles.viewfinderSubtext}>
            {isStreaming
              ? 'Frames routing to AI inference pipeline'
              : 'Connect external UVC camera via USB OTG to activate'}
          </Text>
        </View>

        {isStreaming ? (
          <View style={styles.recordingPill}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>STREAMING</Text>
          </View>
        ) : null}
      </View>

      {/* Primary Camera Controls */}
      <View style={styles.controlsSection}>
        {!isConnected ? (
          <AccessibleButton
            title="Connect External Camera"
            subtitle="Simulates USB OTG handshake"
            accessibilityLabel="Connect external camera"
            accessibilityHint="Detects and establishes connection with UVC camera"
            variant="primary"
            loading={loading}
            onPress={handleConnectCamera}
          />
        ) : (
          <>
            <AccessibleButton
              title={isStreaming ? 'Pause Camera Stream' : 'Start Camera Stream'}
              subtitle={isStreaming ? 'Stop frame ingestion' : 'Begin live video ingestion'}
              accessibilityLabel={
                isStreaming ? 'Pause camera stream' : 'Start camera stream'
              }
              variant={isStreaming ? 'secondary' : 'primary'}
              onPress={handleToggleStream}
            />

            <AccessibleButton
              title="Disconnect Camera"
              subtitle="Safely release USB device session"
              accessibilityLabel="Disconnect camera"
              accessibilityHint="Releases external camera device"
              variant="outlined"
              onPress={handleDisconnectCamera}
            />
          </>
        )}
      </View>

      {/* Hardware Details & Lifecycle Status */}
      <View style={styles.statusSection}>
        <Text style={styles.sectionHeader}>Hardware Status</Text>

        <StatusCard
          label="UVC Driver State"
          value={status.toUpperCase()}
          badgeText={isConnected ? 'Ready' : 'Waiting'}
          statusType={
            isStreaming ? 'success' : isConnected ? 'info' : 'neutral'
          }
          description="Monitors Android USB OTG host lifecycle and frame availability"
        />

        <AccessibleCard
          variant="outlined"
          title="Device Specifications"
          subtitle="Detected hardware attributes"
        >
          <Text style={styles.specLine}>
            Device: <Text style={styles.bold}>{deviceInfo?.name || 'No device connected'}</Text>
          </Text>
          <Text style={styles.specLine}>
            Resolution: <Text style={styles.bold}>{deviceInfo?.resolution || 'N/A'}</Text>
          </Text>
          <Text style={styles.specLine}>
            Protocol: <Text style={styles.bold}>UVC 1.5 Video Class</Text>
          </Text>
          <Text style={styles.specLine}>
            Transport: <Text style={styles.bold}>USB OTG Type-C</Text>
          </Text>
        </AccessibleCard>

        {/* Clear Native Bridge Boundary Note */}
        <AccessibleCard
          variant="filled"
          title="Hardware Bridge Architecture"
          subtitle="Native implementation scope"
        >
          <Text style={styles.specDescription}>
            The native Android UVC layer utilizes the Android UsbManager host
            API to enumerate video streaming endpoints. Frame buffers will be
            captured and piped directly to the AI detection service via native
            JNI bridge.
          </Text>
        </AccessibleCard>
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
  viewfinder: {
    height: 220,
    width: '100%',
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 3,
    padding: Spacing.md,
    position: 'relative',
  },
  viewfinderIdle: {
    backgroundColor: '#1E293B',
    borderColor: Colors.outline,
  },
  viewfinderStreaming: {
    backgroundColor: '#0F172A',
    borderColor: Colors.secondary,
  },
  viewfinderCrosshair: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderText: {
    ...Typography.titleMedium,
    color: '#F8FAFC',
    textAlign: 'center',
    fontWeight: '800',
  },
  viewfinderSubtext: {
    ...Typography.bodyMedium,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  recordingPill: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  recordingText: {
    ...Typography.labelMedium,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  controlsSection: {
    marginBottom: Spacing.md,
  },
  statusSection: {
    marginTop: Spacing.md,
  },
  sectionHeader: {
    ...Typography.titleLarge,
    color: Colors.onBackground,
    marginBottom: Spacing.sm,
  },
  specLine: {
    ...Typography.bodyMedium,
    color: Colors.onSurface,
    marginTop: Spacing.xs,
  },
  bold: {
    fontWeight: '700',
    color: Colors.primary,
  },
  specDescription: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
    lineHeight: 22,
    marginTop: Spacing.xs,
  },
});

export default CameraScreen;
