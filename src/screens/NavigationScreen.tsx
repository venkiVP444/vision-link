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
import { navigationService } from '../features/navigation/navigationService';
import { ttsService } from '../features/tts/ttsService';
import {
  NavigationInstruction,
  NavigationStatus,
  LocationCoordinates,
} from '../types';

export const NavigationScreen: React.FC = () => {
  const navigation = useNavigation();
  const [navStatus, setNavStatus] = useState<NavigationStatus>(
    navigationService.getStatus()
  );
  const [currentStep, setCurrentStep] = useState<NavigationInstruction | null>(
    navigationService.getCurrentInstruction()
  );
  const [coords, setCoords] = useState<LocationCoordinates | null>(null);
  const [voiceGuidanceActive, setVoiceGuidanceActive] = useState<boolean>(true);

  useEffect(() => {
    const unsub = navigationService.onNavigationUpdate((status, step, loc) => {
      setNavStatus(status);
      setCurrentStep(step || null);
      if (loc) setCoords(loc);
    });

    return () => {
      unsub();
    };
  }, []);

  const handleStartNavigation = async () => {
    await navigationService.startNavigation('Main Lobby');
    const step = navigationService.getCurrentInstruction();
    if (step && voiceGuidanceActive) {
      await ttsService.speak(`Navigation started. ${step.instruction}`);
    }
  };

  const handleNextStep = async () => {
    const step = navigationService.nextStep();
    if (step && voiceGuidanceActive) {
      await ttsService.speak(step.instruction);
    }
  };

  const handleStopNavigation = async () => {
    navigationService.stopNavigation();
    if (voiceGuidanceActive) {
      await ttsService.speak('Navigation stopped.');
    }
  };

  const handleRepeatInstruction = async () => {
    if (currentStep) {
      await ttsService.speak(currentStep.instruction);
    } else {
      await ttsService.speak('No active navigation instruction.');
    }
  };

  const isNavigating = navStatus === 'navigating';
  const hasArrived = navStatus === 'arrived';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader
        screenTitle="Navigation"
        subtitle="GPS pedestrian wayfinding & route guidance"
        onBackPress={() => navigation.goBack()}
      />

      {/* Primary Turn-by-Turn Instruction Area */}
      {isNavigating || hasArrived ? (
        <AccessibleCard
          variant="elevated"
          style={hasArrived ? styles.arrivedCard : styles.instructionCard}
          accessibilityLabel={`Current direction: ${
            currentStep?.instruction || 'Following route'
          }`}
        >
          <View style={styles.directionHeader}>
            <Text style={styles.directionBadge}>
              {currentStep?.direction?.toUpperCase() || 'STRAIGHT'}
            </Text>
            {currentStep?.distanceMeters !== undefined ? (
              <Text style={styles.distanceBadge}>
                {currentStep.distanceMeters > 0
                  ? `${currentStep.distanceMeters} METERS`
                  : 'DESTINATION REACHED'}
              </Text>
            ) : null}
          </View>

          <Text style={styles.largeInstructionText}>
            {currentStep?.instruction || 'Proceed along designated path.'}
          </Text>

          <View style={styles.guidanceRow}>
            <AccessibleButton
              title="Repeat Spoken Guidance"
              accessibilityLabel="Repeat current spoken instruction"
              accessibilityHint="Plays the current direction through Text-to-Speech"
              variant="tonal"
              onPress={handleRepeatInstruction}
              style={styles.actionBtn}
            />

            {!hasArrived ? (
              <AccessibleButton
                title="Next Step (Simulation)"
                accessibilityLabel="Advance to next step in simulated route"
                accessibilityHint="Simulates walking forward to the next waypoint"
                variant="outlined"
                onPress={handleNextStep}
                style={styles.actionBtn}
              />
            ) : null}
          </View>
        </AccessibleCard>
      ) : (
        <AccessibleCard
          variant="outlined"
          title="Ready to Guide"
          subtitle="Select or confirm your destination to begin step-by-step assistance"
        >
          <Text style={styles.bodyText}>
            Target Destination: <Text style={styles.boldText}>Main Lobby</Text>
          </Text>
          <Text style={styles.bodySecondary}>
            GPS Signal: High accuracy (±3.5m)
          </Text>
        </AccessibleCard>
      )}

      {/* Navigation Controls */}
      <View style={styles.controlsSection}>
        {!isNavigating ? (
          <AccessibleButton
            title="Start Route Guidance"
            accessibilityLabel="Start route guidance to Main Lobby"
            accessibilityHint="Begins spoken turn-by-turn navigation"
            variant="primary"
            onPress={handleStartNavigation}
          />
        ) : (
          <AccessibleButton
            title="Stop Navigation"
            accessibilityLabel="Stop route guidance"
            accessibilityHint="Ends active navigation and returns to standby"
            variant="danger"
            onPress={handleStopNavigation}
          />
        )}

        <AccessibleButton
          title={
            voiceGuidanceActive
              ? 'Voice Guidance: ON'
              : 'Voice Guidance: MUTED'
          }
          accessibilityLabel={`Voice guidance is currently ${
            voiceGuidanceActive ? 'on' : 'muted'
          }. Tap to toggle.`}
          variant="secondary"
          onPress={() => setVoiceGuidanceActive(!voiceGuidanceActive)}
        />
      </View>

      {/* GPS Status and Provider Information */}
      <View style={styles.statusSection}>
        <Text style={styles.sectionHeader}>Location Telemetry</Text>
        <StatusCard
          label="GPS Provider"
          value={
            coords
              ? `Lat: ${coords.latitude.toFixed(4)}, Lon: ${coords.longitude.toFixed(4)}`
              : 'GPS Fixed (Mock Sensor)'
          }
          badgeText="Active"
          statusType="success"
          description="High precision walking coordinates updated at 1 Hz"
        />

        <StatusCard
          label="Map Provider Layer"
          value="Native Geolocation Abstraction"
          badgeText="Modular"
          statusType="info"
          description="Decoupled from paid map services (Google Maps / Mapbox compatible)"
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
  instructionCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.primary,
    borderWidth: 2.5,
    marginBottom: Spacing.lg,
  },
  arrivedCard: {
    backgroundColor: Colors.secondaryContainer,
    borderColor: Colors.secondary,
    borderWidth: 2.5,
    marginBottom: Spacing.lg,
  },
  directionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  directionBadge: {
    ...Typography.labelLarge,
    color: Colors.primary,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  distanceBadge: {
    ...Typography.labelLarge,
    color: Colors.onSurfaceVariant,
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  largeInstructionText: {
    ...Typography.headline,
    color: Colors.onSurface,
    lineHeight: 34,
    marginVertical: Spacing.sm,
  },
  guidanceRow: {
    marginTop: Spacing.md,
  },
  actionBtn: {
    marginVertical: Spacing.xs,
  },
  bodyText: {
    ...Typography.bodyLarge,
    color: Colors.onSurface,
    marginTop: Spacing.xs,
  },
  boldText: {
    fontWeight: '700',
    color: Colors.primary,
  },
  bodySecondary: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.xs,
  },
  controlsSection: {
    marginVertical: Spacing.md,
  },
  statusSection: {
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    ...Typography.titleLarge,
    color: Colors.onBackground,
    marginBottom: Spacing.sm,
  },
});

export default NavigationScreen;
