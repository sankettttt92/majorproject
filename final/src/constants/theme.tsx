import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// ─── Emergency Command Center theme (light) ──────────────────────────────────
export const COLORS = {
  bg: '#F7F8FA',
  bgCard: '#FFFFFF',
  bgCardBorder: '#E3E6EB',
  bgSurface: '#EFF1F5',
  blue: '#1A6EFF',
  blueDim: 'rgba(26,110,255,0.08)',
  blueBorder: 'rgba(26,110,255,0.25)',
  critical: '#E0263F',
  criticalBg: 'rgba(224,38,63,0.08)',
  criticalBorder: 'rgba(224,38,63,0.25)',
  warning: '#B7791F',
  warningBg: 'rgba(183,121,31,0.10)',
  warningBorder: 'rgba(183,121,31,0.25)',
  success: '#1F9D55',
  successBg: 'rgba(31,157,85,0.10)',
  info: '#1A6EFF',
  infoBg: 'rgba(26,110,255,0.08)',
  textPrimary: '#1A1D24',
  textSecondary: '#5B6270',
  textMuted: '#9AA1AC',
  textMono: '#1A1D24',
  sos: '#E0263F',
  sosBorder: '#E0263F',
  sosBg: 'rgba(224,38,63,0.04)',
};