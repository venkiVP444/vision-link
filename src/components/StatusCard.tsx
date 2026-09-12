import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Elevation } from '../theme';

export type StatusType = 'info' | 'success' | 'warning' | 'error' | 'neutral';

interface StatusCardProps {
  label: string;
  value: string;
  description?: string;
  statusType?: StatusType;
  badgeText?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  label,
  value,
  description,
  statusType = 'neutral',
  badgeText,
}) => {
  const getColors = () => {
    switch (statusType) {
      case 'success':
        return {
          bg: Colors.secondaryContainer,
          border: Colors.secondary,
          badgeBg: Colors.secondary,
          badgeText: Colors.onSecondary,
        };
      case 'warning':
        return {
          bg: Colors.warningContainer,
          border: Colors.warning,
          badgeBg: Colors.warning,
          badgeText: '#FFFFFF',
        };
      case 'error':
        return {
          bg: Colors.errorContainer,
          border: Colors.error,
          badgeBg: Colors.error,
          badgeText: Colors.onError,
        };
      case 'info':
        return {
          bg: Colors.infoContainer,
          border: Colors.info,
          badgeBg: Colors.info,
          badgeText: '#FFFFFF',
        };
      case 'neutral':
      default:
        return {
          bg: Colors.surface,
          border: Colors.outlineVariant,
          badgeBg: Colors.surfaceVariant,
          badgeText: Colors.onSurfaceVariant,
        };
    }
  };

  const scheme = getColors();

  return (
    <View
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}. ${description || ''}`}
      style={[
        styles.container,
        {
          backgroundColor: scheme.bg,
          borderColor: scheme.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.labelText}>{label}</Text>
        {badgeText ? (
          <View style={[styles.badge, { backgroundColor: scheme.badgeBg }]}>
            <Text style={[styles.badgeLabel, { color: scheme.badgeText }]}>
              {badgeText}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.valueText}>{value}</Text>

      {description ? (
        <Text style={styles.descriptionText}>{description}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    padding: Spacing.lg,
    marginVertical: Spacing.sm,
    width: '100%',
    ...Elevation.level1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  labelText: {
    ...Typography.labelMedium,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeLabel: {
    ...Typography.labelMedium,
    fontWeight: '700',
    fontSize: 12,
  },
  valueText: {
    ...Typography.titleLarge,
    color: Colors.onSurface,
    marginTop: Spacing.xs,
  },
  descriptionText: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.xs,
    lineHeight: 22,
  },
});

export default StatusCard;
