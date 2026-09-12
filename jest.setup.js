/* eslint-env jest */
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

jest.mock('react-native-screens', () => {
  const React = require('react');
  const { View } = require('react-native');
  const ViewComponent = ({ children, ...props }) => React.createElement(View, props, children);
  return {
    enableScreens: jest.fn(),
    screensEnabled: jest.fn(() => true),
    compatibilityFlags: {
      usesNewAndroidHeaderHeightImplementation: false,
    },
    Screen: ViewComponent,
    ScreenContainer: ViewComponent,
    ScreenStack: ViewComponent,
    ScreenStackItem: ViewComponent,
    NativeScreen: ViewComponent,
    NativeScreenContainer: ViewComponent,
    NativeScreenNavigationContainer: ViewComponent,
    ScreenStackHeaderConfig: ViewComponent,
    ScreenStackHeaderSubview: ViewComponent,
    SearchBar: ViewComponent,
    FullWindowOverlay: ViewComponent,
  };
});
