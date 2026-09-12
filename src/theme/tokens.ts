/**
 * Vision-Link Material 3 Design Tokens
 * 
 * Adheres to Google's Material 3 Design Kit principles:
 * - High contrast (WCAG AAA compliant ratios for assistive vision)
 * - Large touch targets (>= 48dp, standard 52dp - 56dp)
 * - Clear typographic hierarchy and large font scales
 * - Android-friendly design system
 */

export const Colors = {
  // Material 3 Core Palette (High Contrast Dark/Light Theme for Visually Impaired)
  primary: '#0D47A1',           // Deep high-contrast blue
  onPrimary: '#FFFFFF',
  primaryContainer: '#E3F2FD',  // Soft tint for selected/container elements
  onPrimaryContainer: '#0A2540',

  secondary: '#2E7D32',         // Deep accessible green
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8F5E9',
  onSecondaryContainer: '#1B5E20',

  tertiary: '#5E35B1',          // Accessible deep purple
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#EDE7F6',
  onTertiaryContainer: '#311B92',

  // Error / Alert (Emergency SOS)
  error: '#B71C1C',             // High contrast vivid crimson
  onError: '#FFFFFF',
  errorContainer: '#FFEBEE',
  onErrorContainer: '#7F0000',

  // Neutral / Surface
  background: '#F8FAFC',        // Crisp light slate background
  onBackground: '#0F172A',      // Near-black high contrast text
  surface: '#FFFFFF',
  onSurface: '#0F172A',
  surfaceVariant: '#E2E8F0',
  onSurfaceVariant: '#334155',

  // Outline & Borders
  outline: '#94A3B8',
  outlineVariant: '#CBD5E1',

  // Status & Informative
  success: '#15803D',
  warning: '#B45309',
  warningContainer: '#FEF3C7',
  onWarningContainer: '#78350F',
  info: '#0369A1',
  infoContainer: '#E0F2FE',
  onInfoContainer: '#0C4A6E',

  // Focus & Pressed Highlights
  focusRing: '#2563EB',
  scrim: 'rgba(0, 0, 0, 0.65)',
} as const;

export const Typography = {
  // Large, legible scales for assistive mobile use
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  titleLarge: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
  },
  titleMedium: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  bodyLarge: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  labelLarge: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  labelMedium: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Elevation = {
  level0: {
    elevation: 0,
    shadowColor: 'transparent',
  },
  level1: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  level2: {
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  level3: {
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
} as const;

export const Dimensions = {
  minTouchTarget: 52, // Exceeds 48dp minimum for accessible touch
  largeButtonHeight: 56,
  sosButtonSize: 130,
} as const;
