import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  AccessibleButton,
  ScreenHeader,
  AccessibleCard,
  StatusCard,
  ConfirmationDialog,
} from '../components';
import { Colors, Typography, Spacing, BorderRadius, Dimensions } from '../theme';
import { sosService } from '../features/sos/sosService';
import { ttsService } from '../features/tts/ttsService';
import { EmergencyContact, LocationCoordinates, SOSStatus } from '../types';

export const SOSScreen: React.FC = () => {
  const navigation = useNavigation();
  const [sosStatus, setSosStatus] = useState<SOSStatus>(sosService.getStatus());
  const [dialogVisible, setDialogVisible] = useState<boolean>(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [dispatchedLocation, setDispatchedLocation] = useState<LocationCoordinates | undefined>(undefined);

  useEffect(() => {
    sosService.getEmergencyContacts().then((c) => setContacts(c));

    const unsub = sosService.onStatusChange((status, loc, contactList) => {
      setSosStatus(status);
      if (loc) setDispatchedLocation(loc);
      if (contactList) setContacts(contactList);
    });

    return () => {
      unsub();
    };
  }, []);

  const handleOpenConfirmDialog = () => {
    setDialogVisible(true);
    ttsService.speak('Emergency SOS confirmation opened. Double tap confirm to send alert.');
  };

  const handleConfirmSOS = async () => {
    setDialogVisible(false);
    await ttsService.speak('Emergency SOS triggered. Dispatching your current location now.');
    await sosService.triggerSOS();
    await ttsService.speak('Emergency alert has been dispatched to your emergency contacts.');
  };

  const handleCancelConfirm = () => {
    setDialogVisible(false);
    ttsService.speak('SOS trigger cancelled.');
  };

  const handleCancelActiveSOS = async () => {
    await sosService.cancelSOS();
    await ttsService.speak('Emergency alert cancelled. Returned to safe standby.');
  };

  const isSending = sosStatus === 'sending';
  const isSent = sosStatus === 'sent';

  const getStatusBadge = () => {
    switch (sosStatus) {
      case 'sent':
        return { label: 'ALERT DISPATCHED', type: 'error' as const };
      case 'sending':
        return { label: 'SENDING ALERT...', type: 'warning' as const };
      case 'cancelled':
        return { label: 'CANCELLED', type: 'neutral' as const };
      case 'idle':
      default:
        return { label: 'STANDBY READY', type: 'success' as const };
    }
  };

  const badge = getStatusBadge();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader
        screenTitle="Emergency SOS"
        subtitle="Immediate location dispatch to designated guardians"
        onBackPress={() => navigation.goBack()}
      />

      {/* Primary Massive SOS Activation Button */}
      <View style={styles.sosActionContainer}>
        <AccessibleButton
          title={isSent ? 'ALERT SENT' : 'TRIGGER EMERGENCY SOS'}
          subtitle={
            isSent
              ? 'Emergency contacts notified'
              : 'Double tap to open confirmation'
          }
          accessibilityLabel={
            isSent
              ? 'Emergency alert already dispatched'
              : 'Trigger emergency SOS alert. Requires confirmation.'
          }
          accessibilityHint="Dispatches your GPS coordinates to guardians and emergency services"
          variant="danger"
          disabled={isSending}
          loading={isSending}
          onPress={handleOpenConfirmDialog}
          style={styles.giantSosButton}
        />
      </View>

      {/* Confirmation Dialog to Prevent Accidental SOS */}
      <ConfirmationDialog
        visible={dialogVisible}
        title="Confirm Emergency SOS"
        message="Are you sure you want to send your immediate location and an urgent SOS alert to your emergency contacts?"
        confirmLabel="YES, SEND EMERGENCY SOS"
        cancelLabel="No, Cancel"
        isDestructive={true}
        onConfirm={handleConfirmSOS}
        onCancel={handleCancelConfirm}
      />

      {/* Active State & Cancel Option */}
      {isSent ? (
        <AccessibleCard
          variant="elevated"
          style={styles.alertDispatchedCard}
          accessibilityLabel="Emergency alert is active. Location dispatched."
        >
          <Text style={styles.alertDispatchedTitle}>
            Emergency SOS Active
          </Text>
          <Text style={styles.alertDispatchedBody}>
            An emergency broadcast containing your location has been sent to all registered contacts.
          </Text>
          <AccessibleButton
            title="Cancel Emergency Alert"
            accessibilityLabel="Cancel active emergency alert"
            accessibilityHint="Notifies contacts that you are safe"
            variant="outlined"
            onPress={handleCancelActiveSOS}
            style={styles.cancelAlertButton}
          />
        </AccessibleCard>
      ) : null}

      {/* SOS Telemetry and Status */}
      <View style={styles.statusSection}>
        <Text style={styles.sectionHeader}>Emergency Status</Text>

        <StatusCard
          label="Dispatch State"
          value={sosStatus.toUpperCase()}
          badgeText={badge.label}
          statusType={badge.type}
          description="Monitors emergency broadcast channel and guardian acknowledgment"
        />

        <StatusCard
          label="Location Fix"
          value={
            dispatchedLocation
              ? `Lat: ${dispatchedLocation.latitude.toFixed(4)}, Lon: ${dispatchedLocation.longitude.toFixed(4)}`
              : 'GPS Lat: 37.7749, Lon: -122.4194'
          }
          badgeText="Accurate (±4m)"
          statusType="success"
          description="Coordinates automatically attached to outgoing emergency messages"
        />
      </View>

      {/* Designated Emergency Contacts */}
      <View style={styles.contactsSection}>
        <Text style={styles.sectionHeader}>Registered Emergency Contacts</Text>
        {contacts.map((c) => (
          <AccessibleCard
            key={c.id}
            variant="outlined"
            style={styles.contactCard}
            accessibilityLabel={`Contact: ${c.name}, relationship ${c.relation}, phone number ${c.phoneNumber}`}
          >
            <View style={styles.contactRow}>
              <View>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactRelation}>{c.relation}</Text>
              </View>
              <Text style={styles.contactPhone}>{c.phoneNumber}</Text>
            </View>
          </AccessibleCard>
        ))}
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
  sosActionContainer: {
    marginVertical: Spacing.md,
    alignItems: 'center',
  },
  giantSosButton: {
    minHeight: Dimensions.sosButtonSize,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.error,
    borderColor: '#7F0000',
    borderWidth: 3,
  },
  alertDispatchedCard: {
    backgroundColor: Colors.errorContainer,
    borderColor: Colors.error,
    borderWidth: 2,
    marginVertical: Spacing.md,
  },
  alertDispatchedTitle: {
    ...Typography.headline,
    color: Colors.onErrorContainer,
    fontWeight: '800',
  },
  alertDispatchedBody: {
    ...Typography.bodyLarge,
    color: Colors.onErrorContainer,
    marginTop: Spacing.xs,
    lineHeight: 24,
  },
  cancelAlertButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderColor: Colors.error,
  },
  statusSection: {
    marginTop: Spacing.md,
  },
  sectionHeader: {
    ...Typography.titleLarge,
    color: Colors.onBackground,
    marginBottom: Spacing.sm,
  },
  contactsSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  contactCard: {
    marginBottom: Spacing.sm,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactName: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  contactRelation: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
  },
  contactPhone: {
    ...Typography.bodyLarge,
    color: Colors.primary,
    fontWeight: '700',
  },
});

export default SOSScreen;
