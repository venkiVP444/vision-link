import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  AccessibleButton,
  ScreenHeader,
  AccessibleCard,
  StatusCard,
} from '../components';
import { Colors, Typography, Spacing } from '../theme';
import { ttsService } from '../features/tts/ttsService';
import { TTSLanguage } from '../types';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();

  // Accessibility Preferences
  const [highContrast, setHighContrast] = useState<boolean>(true);
  const [hapticFeedback, setHapticFeedback] = useState<boolean>(true);

  // Voice & TTS Settings
  const [autoAnnounce, setAutoAnnounce] = useState<boolean>(true);
  const [speechRateFast, setSpeechRateFast] = useState<boolean>(false);
  const [ttsLanguage, setTtsLanguage] = useState<TTSLanguage>(
    ttsService.getPreferences().language || 'en-US'
  );

  // Detection Preferences
  const [strictThreshold, setStrictThreshold] = useState<boolean>(false);
  const [proximityAlerts, setProximityAlerts] = useState<boolean>(true);

  // Hardware & Device
  const [cameraAutoConnect, setCameraAutoConnect] = useState<boolean>(true);

  const handleTestVoice = async () => {
    if (ttsLanguage === 'ha-NG') {
      await ttsService.speak('Wannan gwajin muryar Vision-Link ne.');
    } else {
      await ttsService.speak(
        'This is a voice feedback test for the Vision-Link assistive interface.'
      );
    }
  };

  const handleToggleSpeechRate = () => {
    const nextFast = !speechRateFast;
    setSpeechRateFast(nextFast);
    const newRate = nextFast ? 1.4 : 1.0;
    ttsService.setPreferences({ speechRate: newRate });
    if (ttsLanguage === 'ha-NG') {
      ttsService.speak(`Gudun murya: ${nextFast ? 'Sauri' : 'Daidai'}.`);
    } else {
      ttsService.speak(`Speech rate set to ${nextFast ? '1.4x fast' : '1.0x standard'}.`);
    }
  };

  const handleToggleLanguage = () => {
    const nextLang: TTSLanguage = ttsLanguage === 'en-US' ? 'ha-NG' : 'en-US';
    setTtsLanguage(nextLang);
    ttsService.setPreferences({ language: nextLang });
    if (nextLang === 'ha-NG') {
      ttsService.speak('An sa harshe zuwa Hausa.');
    } else {
      ttsService.speak('Speech language set to English.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader
        screenTitle="Settings"
        subtitle="Accessibility, voice, and detection preferences"
        onBackPress={() => navigation.goBack()}
      />

      {/* Accessibility Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Vision & Accessibility</Text>

        <AccessibleCard
          variant="outlined"
          style={styles.settingCard}
          accessibilityLabel={`High Contrast Mode is ${highContrast ? 'enabled' : 'disabled'}`}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>High Contrast UI</Text>
              <Text style={styles.settingSubtitle}>
                Enforces maximum contrast WCAG AAA ratios across all screens
              </Text>
            </View>
            <Switch
              value={highContrast}
              onValueChange={setHighContrast}
              thumbColor={highContrast ? Colors.primary : Colors.outline}
              trackColor={{ false: Colors.outlineVariant, true: Colors.primaryContainer }}
              accessibilityLabel="Toggle High Contrast Mode"
            />
          </View>
        </AccessibleCard>

        <AccessibleCard
          variant="outlined"
          style={styles.settingCard}
          accessibilityLabel={`Haptic feedback is ${hapticFeedback ? 'enabled' : 'disabled'}`}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Haptic Feedback</Text>
              <Text style={styles.settingSubtitle}>
                Vibrate on button taps, obstacle warnings, and navigation cues
              </Text>
            </View>
            <Switch
              value={hapticFeedback}
              onValueChange={setHapticFeedback}
              thumbColor={hapticFeedback ? Colors.primary : Colors.outline}
              trackColor={{ false: Colors.outlineVariant, true: Colors.primaryContainer }}
              accessibilityLabel="Toggle Haptic Feedback"
            />
          </View>
        </AccessibleCard>
      </View>

      {/* Spoken Voice / TTS Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Spoken Guidance & Audio</Text>

        <AccessibleCard
          variant="outlined"
          style={styles.settingCard}
          accessibilityLabel={`Spoken language is currently ${
            ttsLanguage === 'ha-NG' ? 'Hausa ha-NG' : 'English en-US'
          }`}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Spoken Guidance Language</Text>
              <Text style={styles.settingSubtitle}>
                {ttsLanguage === 'ha-NG'
                  ? 'Hausa (ha-NG) — "Akwai mutum a gabanka, ka kula."'
                  : 'English (en-US) — "Person ahead. Please be careful."'}
              </Text>
            </View>
            <AccessibleButton
              title={ttsLanguage === 'ha-NG' ? 'Hausa (ha-NG)' : 'English (en-US)'}
              accessibilityLabel={`Change spoken language. Currently ${
                ttsLanguage === 'ha-NG' ? 'Hausa' : 'English'
              }`}
              variant="primary"
              onPress={handleToggleLanguage}
              style={styles.langButton}
            />
          </View>
        </AccessibleCard>

        <AccessibleCard
          variant="outlined"
          style={styles.settingCard}
          accessibilityLabel={`Auto-announce obstacles is ${autoAnnounce ? 'enabled' : 'disabled'}`}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Auto-Announce Obstacles</Text>
              <Text style={styles.settingSubtitle}>
                Immediately speak detected critical hazards without prompting
              </Text>
            </View>
            <Switch
              value={autoAnnounce}
              onValueChange={(val) => {
                setAutoAnnounce(val);
                ttsService.setPreferences({ autoAnnounceDetections: val });
              }}
              thumbColor={autoAnnounce ? Colors.primary : Colors.outline}
              trackColor={{ false: Colors.outlineVariant, true: Colors.primaryContainer }}
              accessibilityLabel="Toggle Auto-Announce Obstacles"
            />
          </View>
        </AccessibleCard>

        <AccessibleButton
          title={speechRateFast ? 'Speech Rate: 1.4x (Fast)' : 'Speech Rate: 1.0x (Standard)'}
          subtitle="Tap to toggle spoken guidance playback speed"
          accessibilityLabel={`Speech rate is currently ${speechRateFast ? 'fast' : 'standard'}. Double tap to toggle.`}
          variant="tonal"
          onPress={handleToggleSpeechRate}
        />

        <AccessibleButton
          title="Test Voice Synthesis"
          subtitle="Plays sample audio through Text-to-Speech"
          accessibilityLabel="Test voice synthesis audio sample"
          variant="outlined"
          onPress={handleTestVoice}
        />
      </View>

      {/* AI & Detection Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Obstacle Detection Preferences</Text>

        <AccessibleCard
          variant="outlined"
          style={styles.settingCard}
          accessibilityLabel={`High confidence filter is ${strictThreshold ? 'enabled' : 'disabled'}`}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>High Confidence Filter</Text>
              <Text style={styles.settingSubtitle}>
                Only alert obstacles with over 85% detection certainty
              </Text>
            </View>
            <Switch
              value={strictThreshold}
              onValueChange={setStrictThreshold}
              thumbColor={strictThreshold ? Colors.primary : Colors.outline}
              trackColor={{ false: Colors.outlineVariant, true: Colors.primaryContainer }}
              accessibilityLabel="Toggle High Confidence Filter"
            />
          </View>
        </AccessibleCard>

        <AccessibleCard
          variant="outlined"
          style={styles.settingCard}
          accessibilityLabel={`Proximity audio alerts are ${proximityAlerts ? 'enabled' : 'disabled'}`}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Proximity Distance Alerts</Text>
              <Text style={styles.settingSubtitle}>
                Emit urgent warning tone when obstacles are within 2.0 meters
              </Text>
            </View>
            <Switch
              value={proximityAlerts}
              onValueChange={setProximityAlerts}
              thumbColor={proximityAlerts ? Colors.primary : Colors.outline}
              trackColor={{ false: Colors.outlineVariant, true: Colors.primaryContainer }}
              accessibilityLabel="Toggle Proximity Distance Alerts"
            />
          </View>
        </AccessibleCard>
      </View>

      {/* Hardware Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>External Camera & Devices</Text>

        <AccessibleCard
          variant="outlined"
          style={styles.settingCard}
          accessibilityLabel={`USB Auto-connect is ${cameraAutoConnect ? 'enabled' : 'disabled'}`}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>USB OTG Auto-Connect</Text>
              <Text style={styles.settingSubtitle}>
                Automatically initialize camera session when UVC device is plugged in
              </Text>
            </View>
            <Switch
              value={cameraAutoConnect}
              onValueChange={setCameraAutoConnect}
              thumbColor={cameraAutoConnect ? Colors.primary : Colors.outline}
              trackColor={{ false: Colors.outlineVariant, true: Colors.primaryContainer }}
              accessibilityLabel="Toggle USB OTG Auto-Connect"
            />
          </View>
        </AccessibleCard>

        <StatusCard
          label="Bluetooth Smart-Glasses / Audio"
          value="Routing Standby"
          badgeText="Supported"
          statusType="info"
          description="Ready to route spoken instructions directly to smart-glasses audio earpiece"
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    flexGrow: 1,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    ...Typography.titleLarge,
    color: Colors.onBackground,
    marginBottom: Spacing.sm,
  },
  settingCard: {
    marginBottom: Spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  settingTitle: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  settingSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.xs,
  },
  langButton: {
    marginVertical: 0,
    minWidth: 120,
  },
});

export default SettingsScreen;
