import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  AccessibleButton,
  ScreenHeader,
  AccessibleCard,
} from '../components';
import { Colors, Typography, Spacing } from '../theme';
import { ttsService, TTS_LANGUAGE_OPTIONS } from '../features/tts/ttsService';
import { VOICE_REGISTRY, VoicePackStatus } from '../features/tts/voiceRegistry';
import { TTSLanguage, TTSLanguageOption } from '../types';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();

  // Accessibility Preferences
  const [highContrast, setHighContrast] = useState<boolean>(true);
  const [hapticFeedback, setHapticFeedback] = useState<boolean>(true);

  // Voice & TTS Settings
  const [autoAnnounce, setAutoAnnounce] = useState<boolean>(
    ttsService.getPreferences().autoAnnounceDetections !== false
  );
  const [speechRateFast, setSpeechRateFast] = useState<boolean>(false);
  const [ttsLanguage, setTtsLanguage] = useState<TTSLanguage>(
    ttsService.getPreferences().language || 'en-GB'
  );
  const [voiceStatuses, setVoiceStatuses] = useState<Record<string, VoicePackStatus>>({});
  const [downloadingLang, setDownloadingLang] = useState<string | null>(null);

  // Detection Preferences
  const [strictThreshold, setStrictThreshold] = useState<boolean>(false);
  const [proximityAlerts, setProximityAlerts] = useState<boolean>(true);

  // Refresh voice pack statuses
  const refreshVoiceStatuses = useCallback(async () => {
    const statuses: Record<string, VoicePackStatus> = {};
    for (const opt of TTS_LANGUAGE_OPTIONS) {
      statuses[opt.code] = await ttsService.getVoicePackStatus(opt.code);
    }
    setVoiceStatuses(statuses);
  }, []);

  useEffect(() => {
    refreshVoiceStatuses();
  }, [refreshVoiceStatuses]);

  const handleDownloadVoicePack = async (lang: TTSLanguage, langName: string) => {
    setDownloadingLang(lang);
    try {
      await ttsService.downloadVoicePack(lang);
      await refreshVoiceStatuses();
      Alert.alert(
        'Voice Pack Ready',
        `${langName} offline neural voice pack installed and SHA-256 verified successfully. It will now work completely offline.`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert(
        'Voice Pack Installation Failed',
        `Failed to install ${langName} voice pack: ${err?.message || 'Checksum mismatch or network failure'}. The voice remains unavailable.`,
        [{ text: 'OK' }]
      );
    } finally {
      setDownloadingLang(null);
    }
  };

  const playLanguagePreview = async (lang: TTSLanguage) => {
    try {
      switch (lang) {
        case 'ha-NG':
          await ttsService.speak('Akwai mutum a gabanka, ka kula.', 'ha-NG');
          break;
        case 'ar':
          await ttsService.speak('يوجد شخص أمامك. يرجى توخي الحذر.', 'ar');
          break;
        case 'hi-IN':
          await ttsService.speak('सामने व्यक्ति है। कृपया सावधान रहें।', 'hi-IN');
          break;
        case 'en-GB':
        case 'en-US':
        default:
          await ttsService.speak('Person ahead. Please be careful.', lang);
          break;
      }
    } catch (error: any) {
      console.warn('[SettingsScreen] Voice preview error:', error?.message || error);
      Alert.alert(
        'TTS Playback Error',
        `Voice playback failed: ${error?.message || 'Offline neural model error'}.`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleSelectLanguage = async (option: TTSLanguageOption) => {
    const meta = VOICE_REGISTRY[option.code];
    const status = voiceStatuses[option.code];

    if (!meta.isBundled && (!status || !status.isInstalled)) {
      Alert.alert(
        'Voice Pack Required',
        `${option.name} is an optional voice pack.\n\nInternet connection required for initial installation.\n\nWould you like to install the voice pack (${meta.sizeMb}) now?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Download Voice Pack',
            onPress: () => handleDownloadVoicePack(option.code, option.name),
          },
        ]
      );
      return;
    }

    setTtsLanguage(option.code);
    ttsService.setPreferences({ language: option.code });

    // Instantly play voice feedback in selected language (no need to click Test Voice)
    await playLanguagePreview(option.code);
  };

  const handleTestVoice = async () => {
    const meta = VOICE_REGISTRY[ttsLanguage];
    const status = voiceStatuses[ttsLanguage];

    if (!meta.isBundled && (!status || !status.isInstalled)) {
      Alert.alert(
        'Voice Pack Required',
        `Internet connection required for initial installation of ${meta.name} voice pack. Please download the voice pack to enable offline synthesis.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Download Now',
            onPress: () => handleDownloadVoicePack(ttsLanguage, meta.name),
          },
        ]
      );
      return;
    }

    await playLanguagePreview(ttsLanguage);
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
        <Text style={styles.sectionHeader}>Spoken Guidance & Offline Voices</Text>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Spoken Guidance Language Options"
          style={styles.languageRadioGroup}
        >
          {TTS_LANGUAGE_OPTIONS.map((opt) => {
            const isSelected = ttsLanguage === opt.code;
            const meta = VOICE_REGISTRY[opt.code];
            const status = voiceStatuses[opt.code];
            const isInstalled = meta?.isBundled || status?.isInstalled;
            const isDownloading = downloadingLang === opt.code;

            const badgeText = isInstalled
              ? 'OFFLINE NEURAL ✓ Ready'
              : isDownloading
              ? 'Installing & Verifying (SHA-256)...'
              : 'Voice Pack Required';

            const displayTitle = `${opt.name} — ${opt.voiceName}`;

            return (
              <View
                key={opt.code}
                style={[
                  styles.languageOptionCard,
                  isSelected && styles.languageOptionCardSelected,
                ]}
              >
                <TouchableOpacity
                  accessible={true}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${opt.name}, ${badgeText}, ${isSelected ? 'selected' : 'not selected'}`}
                  accessibilityHint={`Double tap to select ${opt.name} and preview voice speech immediately`}
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
                        <View
                          style={[
                            styles.neuralBadge,
                            !isInstalled && styles.voicePackRequiredBadge,
                          ]}
                        >
                          <Text
                            style={[
                              styles.neuralBadgeText,
                              !isInstalled && styles.voicePackRequiredBadgeText,
                            ]}
                          >
                            {badgeText}
                          </Text>
                        </View>
                      </View>
                      {!isInstalled && (
                        <Text style={styles.noticeText}>
                          Internet connection required for initial installation.
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Download Voice Pack Action if uninstalled */}
                {!isInstalled && (
                  <View style={styles.downloadContainer}>
                    {isDownloading ? (
                      <View style={styles.downloadingRow}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                        <Text style={styles.downloadingText}>
                          Downloading & verifying SHA-256...
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.downloadButton}
                        onPress={() => handleDownloadVoicePack(opt.code, opt.name)}
                        accessible={true}
                        accessibilityLabel={`Download ${opt.name} Voice Pack, ${meta?.sizeMb || '60.6 MB'}`}
                      >
                        <Text style={styles.downloadButtonText}>
                          Download Voice Pack ({meta?.sizeMb || '60.6 MB'})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
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
    flexWrap: 'wrap',
  },
  languageSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
  },
  neuralBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  neuralBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2E7D32',
    letterSpacing: 0.5,
  },
  voicePackRequiredBadge: {
    backgroundColor: '#FFF3E0',
  },
  voicePackRequiredBadgeText: {
    color: '#E65100',
  },
  noticeText: {
    fontSize: 11,
    color: '#E65100',
    marginTop: 4,
    fontStyle: 'italic',
  },
  downloadContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  downloadButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: Colors.onPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  downloadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  downloadingText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default SettingsScreen;
