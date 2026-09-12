import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { AccessibleButton } from './AccessibleButton';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try Again',
}) => {
  return (
    <View
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={`${title}: ${message}`}
      style={styles.container}
    >
      <Text style={styles.titleText}>{title}</Text>
      <Text style={styles.messageText}>{message}</Text>

      {onRetry ? (
        <AccessibleButton
          title={retryLabel}
          accessibilityLabel={retryLabel}
          accessibilityHint="Retries the previous operation"
          variant="outlined"
          onPress={onRetry}
          style={styles.retryButton}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    backgroundColor: Colors.errorContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.error,
    marginVertical: Spacing.md,
  },
  titleText: {
    ...Typography.titleLarge,
    color: Colors.onErrorContainer,
    fontWeight: '700',
  },
  messageText: {
    ...Typography.bodyMedium,
    color: Colors.onErrorContainer,
    marginTop: Spacing.xs,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderColor: Colors.error,
  },
});

export default ErrorState;
