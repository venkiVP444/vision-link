import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Elevation, Dimensions } from '../theme';

interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={`${title}. ${message}`}
          style={styles.dialogContainer}
        >
          <Text style={styles.titleText}>{title}</Text>
          <Text style={styles.messageText}>{message}</Text>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityHint="Proceeds with the action"
              activeOpacity={0.8}
              onPress={onConfirm}
              style={[
                styles.actionButton,
                isDestructive ? styles.destructiveButton : styles.confirmButton,
              ]}
            >
              <Text
                style={[
                  styles.buttonText,
                  isDestructive ? styles.destructiveText : styles.confirmText,
                ]}
              >
                {confirmLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              accessibilityHint="Dismisses and returns without taking action"
              activeOpacity={0.8}
              onPress={onCancel}
              style={[styles.actionButton, styles.cancelButton]}
            >
              <Text style={[styles.buttonText, styles.cancelText]}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  dialogContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 420,
    borderWidth: 2,
    borderColor: Colors.outlineVariant,
    ...Elevation.level3,
  },
  titleText: {
    ...Typography.headline,
    color: Colors.onSurface,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  messageText: {
    ...Typography.bodyLarge,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  buttonGroup: {
    width: '100%',
  },
  actionButton: {
    minHeight: Dimensions.largeButtonHeight,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  confirmText: {
    color: Colors.onPrimary,
  },
  destructiveButton: {
    backgroundColor: Colors.error,
  },
  destructiveText: {
    color: Colors.onError,
  },
  cancelButton: {
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1.5,
    borderColor: Colors.outline,
  },
  cancelText: {
    color: Colors.onSurface,
  },
  buttonText: {
    ...Typography.titleMedium,
    fontWeight: '700',
  },
});

export default ConfirmationDialog;
