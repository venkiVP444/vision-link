import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Elevation } from '../theme';

interface AccessibleCardProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  variant?: 'elevated' | 'outlined' | 'filled';
  style?: StyleProp<ViewStyle>;
}

export const AccessibleCard: React.FC<AccessibleCardProps> = ({
  title,
  subtitle,
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  variant = 'outlined',
  style,
}) => {
  const getCardStyle = () => {
    switch (variant) {
      case 'elevated':
        return styles.elevatedCard;
      case 'filled':
        return styles.filledCard;
      case 'outlined':
      default:
        return styles.outlinedCard;
    }
  };

  const content = (
    <>
      {title ? (
        <Text style={styles.cardTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      {children ? <View style={styles.bodyContainer}>{children}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        accessibilityHint={accessibilityHint}
        activeOpacity={0.8}
        onPress={onPress}
        style={[styles.baseCard, getCardStyle(), style]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View
      accessible={true}
      accessibilityLabel={accessibilityLabel || title}
      style={[styles.baseCard, getCardStyle(), style]}
    >
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  baseCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginVertical: Spacing.sm,
    width: '100%',
  },
  outlinedCard: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.outlineVariant,
  },
  elevatedCard: {
    backgroundColor: Colors.surface,
    ...Elevation.level2,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  filledCard: {
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  cardTitle: {
    ...Typography.titleLarge,
    color: Colors.onSurface,
  },
  cardSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.xs,
  },
  bodyContainer: {
    marginTop: Spacing.sm,
  },
});

export default AccessibleCard;
