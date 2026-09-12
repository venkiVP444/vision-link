import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { APP_NAME } from '../constants';
import { Colors, Typography, Spacing, BorderRadius, Dimensions } from '../theme';

interface ScreenHeaderProps {
  screenTitle: string;
  subtitle?: string;
  onBackPress?: () => void;
  backAccessibilityLabel?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  screenTitle,
  subtitle,
  onBackPress,
  backAccessibilityLabel = 'Go back to previous screen',
}) => {
  return (
    <View
      accessible={true}
      accessibilityRole="header"
      accessibilityLabel={`${APP_NAME}, ${screenTitle}. ${subtitle || ''}`}
      style={styles.headerContainer}
    >
      <View style={styles.topRow}>
        <View style={styles.titleArea}>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.screenTitle}>{screenTitle}</Text>
        </View>

        {onBackPress ? (
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
            accessibilityHint="Navigates back"
            activeOpacity={0.7}
            onPress={onBackPress}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.outlineVariant,
    marginBottom: Spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleArea: {
    flex: 1,
  },
  appName: {
    ...Typography.labelMedium,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  screenTitle: {
    ...Typography.display,
    color: Colors.onBackground,
    marginTop: Spacing.xs,
  },
  subtitle: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.xs,
  },
  backButton: {
    minHeight: Dimensions.minTouchTarget,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },
  backButtonText: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
  },
});

export default ScreenHeader;
