import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import {
  HomeScreen,
  NavigationScreen,
  CameraScreen,
  ObjectDetectionScreen,
  SOSScreen,
  SettingsScreen,
} from '../screens';
import { Colors, Typography } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.onBackground,
        },
        headerTintColor: Colors.onPrimary,
        headerTitleStyle: {
          ...Typography.titleLarge,
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Vision-Link' }}
      />
      <Stack.Screen
        name="Navigation"
        component={NavigationScreen}
        options={{ title: 'Navigation' }}
      />
      <Stack.Screen
        name="Camera"
        component={CameraScreen}
        options={{ title: 'Camera' }}
      />
      <Stack.Screen
        name="ObjectDetection"
        component={ObjectDetectionScreen}
        options={{ title: 'Object Detection' }}
      />
      <Stack.Screen
        name="SOS"
        component={SOSScreen}
        options={{ title: 'Emergency SOS' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Stack.Navigator>
  );
};

export default RootNavigator;
