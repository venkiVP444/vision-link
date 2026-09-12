import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
}) => {
  return (
    <View
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      style={styles.container}
    >
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.messageText}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.outlineVariant,
    marginVertical: Spacing.md,
  },
  messageText: {
    ...Typography.bodyLarge,
    color: Colors.onSurface,
    marginTop: Spacing.md,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default LoadingState;
