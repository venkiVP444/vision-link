import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { RootStackNavigationProp } from '../navigation/types';
import {
  AccessibleButton,
  ScreenHeader,
  AccessibleCard,
  StatusCard,
} from '../components';
import { Colors, Typography, Spacing } from '../theme';
import { cameraService } from '../features/camera/cameraService';
import { navigationService } from '../features/navigation/navigationService';
import { ttsService } from '../features/tts/ttsService';
import { CameraStatus, NavigationStatus } from '../types';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp<'Home'>>();
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>(
    cameraService.getStatus()
  );
  const [navStatus, setNavStatus] = useState<NavigationStatus>(
    navigationService.getStatus()
  );
  const [isSpeaking, setIsSpeaking] = useState<boolean>(
    ttsService.isSpeaking()
  );

  useEffect(() => {
    const unsubCamera = cameraService.onStatusChange((s) => setCameraStatus(s));
    const unsubNav = navigationService.onNavigationUpdate((s) => setNavStatus(s));
    const unsubTTS = ttsService.onStateChange((speaking) =>
      setIsSpeaking(speaking)
    );

    return () => {
      unsubCamera();
      unsubNav();
      unsubTTS();
    };
  }, []);

  const getCameraBadge = () => {
    switch (cameraStatus) {
      case 'streaming':
        return { type: 'success' as const, label: 'Streaming' };
      case 'connected':
        return { type: 'info' as const, label: 'Connected' };
      case 'connecting':
        return { type: 'warning' as const, label: 'Connecting' };
      default:
        return { type: 'neutral' as const, label: 'Ready for USB' };
    }
  };

  const camBadge = getCameraBadge();

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      accessible={false}
    >
      <ScreenHeader
        screenTitle="Home"
        subtitle="AI-powered assistive vision portal"
      />

      {/* Prominent Quick-Action Emergency SOS Banner */}
      <AccessibleCard
        variant="elevated"
        style={styles.sosCard}
        accessibilityLabel="Emergency SOS Quick Action. Double tap to open Emergency SOS."
      >
        <Text style={styles.sosTitle}>EMERGENCY SOS</Text>
        <Text style={styles.sosSubtitle}>
          Dispatch live location to registered emergency contacts
        </Text>
        <AccessibleButton
          title="Open Emergency SOS"
          accessibilityLabel="Open Emergency SOS screen"
          accessibilityHint="Navigates immediately to emergency alert confirmation"
          variant="danger"
          onPress={() => navigation.navigate('SOS')}
          style={styles.sosButton}
        />
      </AccessibleCard>

      {/* Assistive System Status Overview */}
      <View style={styles.statusSection} accessible={true} accessibilityRole="header">
        <Text style={styles.sectionTitle}>System Readiness</Text>
        <StatusCard
          label="External Camera"
          value={cameraStatus.toUpperCase()}
          badgeText={camBadge.label}
          statusType={camBadge.type}
          description="USB OTG UVC Camera ready for visual guidance"
        />
        <StatusCard
          label="Voice Guidance"
          value={isSpeaking ? 'Speaking guidance' : 'Standby'}
          badgeText={isSpeaking ? 'Active' : 'Ready'}
          statusType={isSpeaking ? 'info' : 'success'}
          description="Spoken feedback enabled via native Text-to-Speech"
        />
        <StatusCard
          label="GPS & Route State"
          value={navStatus === 'navigating' ? 'En Route' : 'Idle'}
          badgeText={navStatus === 'navigating' ? 'Active' : 'Standby'}
          statusType={navStatus === 'navigating' ? 'info' : 'neutral'}
          description="Directional walking instructions for outdoor mobility"
        />
      </View>

      {/* Main Feature Action Buttons */}
      <View style={styles.actionSection}>
        <Text style={styles.sectionTitle}>Assistive Features</Text>

        <AccessibleButton
          title="Object Detection"
          subtitle="Real-time obstacle and item recognition"
          accessibilityLabel="Object detection. Double tap to detect obstacles."
          accessibilityHint="Navigates to AI real-time obstacle and object detection"
          variant="primary"
          onPress={() => navigation.navigate('ObjectDetection')}
        />

        <AccessibleButton
          title="Navigation & Wayfinding"
          subtitle="Turn-by-turn spoken pedestrian directions"
          accessibilityLabel="Navigation and wayfinding. Double tap for walking directions."
          accessibilityHint="Navigates to GPS route guidance"
          variant="tonal"
          onPress={() => navigation.navigate('Navigation')}
        />

        <AccessibleButton
          title="External Camera Preview"
          subtitle="View UVC camera stream and connection lifecycle"
          accessibilityLabel="External camera preview. Double tap to manage UVC camera."
          accessibilityHint="Navigates to external UVC camera controls"
          variant="outlined"
          onPress={() => navigation.navigate('Camera')}
        />

        <AccessibleButton
          title="Settings & Preferences"
          subtitle="Voice rate, contrast, and device settings"
          accessibilityLabel="Settings and preferences. Double tap to customize options."
          accessibilityHint="Navigates to audio and preferences settings"
          variant="secondary"
          onPress={() => navigation.navigate('Settings')}
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
  sosCard: {
    backgroundColor: Colors.errorContainer,
    borderColor: Colors.error,
    borderWidth: 2,
    marginBottom: Spacing.lg,
  },
  sosTitle: {
    ...Typography.headline,
    color: Colors.onErrorContainer,
    fontWeight: '800',
  },
  sosSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.onErrorContainer,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  sosButton: {
    marginVertical: 0,
  },
  statusSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.titleLarge,
    color: Colors.onBackground,
    marginBottom: Spacing.sm,
  },
  actionSection: {
    marginBottom: Spacing.xl,
  },
});

export default HomeScreen;
