import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  TouchableOpacityProps,
  ActivityIndicator,
  View,
} from 'react-native';
import { Colors, Typography, BorderRadius, Dimensions, Elevation } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'outlined' | 'danger';

export interface AccessibleButtonProps extends TouchableOpacityProps {
  title: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  variant?: ButtonVariant;
  subtitle?: string;
  loading?: boolean;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  title,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  variant = 'primary',
  subtitle,
  loading = false,
  style,
  disabled,
  ...props
}) => {
  const getContainerStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryButton;
      case 'tonal':
        return styles.tonalButton;
      case 'outlined':
        return styles.outlinedButton;
      case 'danger':
        return styles.dangerButton;
      case 'primary':
      default:
        return styles.primaryButton;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'secondary':
        return Colors.onSecondaryContainer;
      case 'tonal':
        return Colors.onPrimaryContainer;
      case 'outlined':
        return Colors.primary;
      case 'danger':
        return Colors.onError;
      case 'primary':
      default:
        return Colors.onPrimary;
    }
  };

  const textColor = getTextColor();

  return (
    <TouchableOpacity
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.buttonBase,
        getContainerStyle(),
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={textColor}
          accessibilityLabel="Loading action"
        />
      ) : (
        <View style={styles.contentContainer}>
          <Text style={[styles.textBase, { color: textColor }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitleBase, { color: textColor }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  buttonBase: {
    minHeight: Dimensions.minTouchTarget,
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    ...Elevation.level1,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  secondaryButton: {
    backgroundColor: Colors.secondaryContainer,
    borderColor: Colors.secondary,
    borderWidth: 2,
  },
  tonalButton: {
    backgroundColor: Colors.primaryContainer,
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  outlinedButton: {
    backgroundColor: Colors.surface,
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  dangerButton: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
    borderWidth: 2,
  },
  textBase: {
    ...Typography.titleMedium,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitleBase: {
    ...Typography.labelMedium,
    opacity: 0.9,
    marginTop: 2,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.45,
    elevation: 0,
  },
});

export default AccessibleButton;
