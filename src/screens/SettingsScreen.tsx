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
import { ttsService, TTS_LANGUAGE_OPTIONS } from '../features/tts/ttsService';
import { TTSLanguage, TTSLanguageOption } from '../types';
import { TouchableOpacity } from 'react-native';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();

  // Accessibility Preferences
  const [highContrast, setHighContrast] = useState<boolean>(true);
  const [hapticFeedback, setHapticFeedback] = useState<boolean>(true);

  // Voice & TTS Settings
  const [autoAnnounce, setAutoAnnounce] = useState<boolean>(true);
  const [speechRateFast, setSpeechRateFast] = useState<boolean>(false);
  const [ttsLanguage, setTtsLanguage] = useState<TTSLanguage>(
    ttsService.getPreferences().language || 'en-GB'
  );

  // Detection Preferences
  const [strictThreshold, setStrictThreshold] = useState<boolean>(false);
  const [proximityAlerts, setProximityAlerts] = useState<boolean>(true);

  // Hardware & Device
  const [cameraAutoConnect, setCameraAutoConnect] = useState<boolean>(true);

  const handleTestVoice = async () => {
    switch (ttsLanguage) {
      case 'ha-NG':
        await ttsService.speak('Akwai mutum a gabanka, ka kula.');
        break;
      case 'ar':
        await ttsService.speak('يوجد شخص أمامك. يرجى توخي الحذر.');
        break;
      case 'hi-IN':
        await ttsService.speak('सामने व्यक्ति है। कृपया सावधान रहें।');
        break;
      case 'en-GB':
      default:
        await ttsService.speak('Person ahead. Please be careful.');
        break;
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

  const handleSelectLanguage = (option: TTSLanguageOption) => {
    setTtsLanguage(option.code);
    ttsService.setPreferences({ language: option.code });
    switch (option.code) {
      case 'ha-NG':
        ttsService.speak('An sa harshe zuwa Hausa.');
        break;
      case 'ar':
        ttsService.speak('يوجد شخص أمامك. يرجى توخي الحذر.');
        break;
      case 'hi-IN':
        ttsService.speak('सामने व्यक्ति है। कृपया सावधान रहें।');
        break;
      case 'en-GB':
      default:
        ttsService.speak('Speech language set to English UK.');
        break;
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

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Spoken Guidance Language Options"
          style={styles.languageRadioGroup}
        >
          {TTS_LANGUAGE_OPTIONS.map((opt) => {
            const isSelected = ttsLanguage === opt.code;
            const talkBackLabel = `${opt.name}, ${opt.voiceName}, ${isSelected ? 'selected' : 'not selected'}`;
            const displayTitle = `${opt.name} — ${opt.voiceName}`;

            return (
              <TouchableOpacity
                key={opt.code}
                accessible={true}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={talkBackLabel}
                accessibilityHint={`Double tap to select ${opt.name} ${opt.voiceName} for spoken navigation feedback`}
                style={[
                  styles.languageOptionCard,
                  isSelected && styles.languageOptionCardSelected,
                ]}
                onPress={() => handleSelectLanguage(opt)}
                activeOpacity={0.7}
              >
                <View style={styles.radioRow}>
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.languageTextContainer}>
                    <Text style={[styles.languageTitle, isSelected && styles.languageTitleSelected]}>
                      {displayTitle}
                    </Text>
                    <View style={styles.badgeRow}>
                      <Text style={styles.languageSubtitle}>{opt.nativeName}</Text>
                      {opt.isOfflineNeural && (
                        <View style={styles.neuralBadge}>
                          <Text style={styles.neuralBadgeText}>OFFLINE NEURAL</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

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
  languageRadioGroup: {
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  languageOptionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.outlineVariant,
    padding: Spacing.md,
    minHeight: 56,
    justifyContent: 'center',
  },
  languageOptionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryContainer,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  languageTextContainer: {
    flex: 1,
  },
  languageTitle: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  languageTitleSelected: {
    color: Colors.onPrimaryContainer,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: Spacing.xs,
  },
  languageSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
  },
  neuralBadge: {
    backgroundColor: Colors.secondaryContainer,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  neuralBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.onSecondaryContainer,
    letterSpacing: 0.5,
  },
});

export default SettingsScreen;
