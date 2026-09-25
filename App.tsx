import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation';

const linking = {
  prefixes: ['visionlink://'],
  config: {
    screens: {
      Home: '',
      Navigation: 'navigation',
      Camera: 'camera',
      ObjectDetection: 'detection',
      SOS: 'sos',
      Settings: 'settings',
    },
  },
};

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <NavigationContainer linking={linking}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
