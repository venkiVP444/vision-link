import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {
  AccessibleButton,
  ScreenHeader,
  AccessibleCard,
  StatusCard,
  ConfirmationDialog,
  LoadingState,
  ErrorState,
} from '../src/components';

describe('Material 3 Accessible Components', () => {
  it('renders AccessibleButton with various variants and accessibility props', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AccessibleButton
          title="Emergency Action"
          subtitle="Subtitle info"
          accessibilityLabel="Emergency Action Button"
          accessibilityHint="Triggers an emergency response"
          variant="danger"
          onPress={() => {}}
        />
      );
    });

    const root = renderer!.root;
    expect(root.findByProps({ accessibilityLabel: 'Emergency Action Button' })).toBeTruthy();
  });

  it('renders ScreenHeader with accessible header role', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ScreenHeader screenTitle="Navigation" subtitle="GPS Guidance" />
      );
    });

    const root = renderer!.root;
    expect(root.findByProps({ accessibilityRole: 'header' })).toBeTruthy();
  });

  it('renders AccessibleCard with accessible text content', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AccessibleCard
          title="Card Title"
          subtitle="Card Subtitle"
          accessibilityLabel="Custom Card Label"
        />
      );
    });

    const root = renderer!.root;
    expect(root.findByProps({ accessibilityLabel: 'Custom Card Label' })).toBeTruthy();
  });

  it('renders StatusCard with status badge and description', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <StatusCard
          label="UVC Driver"
          value="STREAMING"
          badgeText="Live"
          statusType="success"
          description="High FPS video buffer active"
        />
      );
    });

    const root = renderer!.root;
    expect(root.findByProps({ accessibilityRole: 'text' })).toBeTruthy();
  });

  it('renders ConfirmationDialog when visible', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ConfirmationDialog
          visible={true}
          title="Confirm Action"
          message="Are you sure you want to proceed?"
          confirmLabel="Yes, Proceed"
          cancelLabel="No, Cancel"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );
    });

    const root = renderer!.root;
    expect(root.findByProps({ accessibilityRole: 'alert' })).toBeTruthy();
  });

  it('renders LoadingState and ErrorState with proper roles', () => {
    let loadingRenderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      loadingRenderer = ReactTestRenderer.create(
        <LoadingState message="Processing frame..." />
      );
    });
    expect(
      loadingRenderer!.root.findByProps({ accessibilityRole: 'progressbar' })
    ).toBeTruthy();

    let errorRenderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      errorRenderer = ReactTestRenderer.create(
        <ErrorState message="Camera connection lost." onRetry={() => {}} />
      );
    });
    expect(
      errorRenderer!.root.findByProps({ accessibilityRole: 'alert' })
    ).toBeTruthy();
  });
});
