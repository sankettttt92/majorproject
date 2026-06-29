// src/utils/theme.js
import { Platform } from 'react-native';

export const COLORS = {
  // Backgrounds
  bg: '#F7F8FA',
  bgCard: '#FFFFFF',
  bgCardBorder: '#E3E6EB',
  bgSurface: '#EFF1F5',

  // Brand
  blue: '#1A6EFF',
  blueDim: 'rgba(26,110,255,0.08)',
  blueBorder: 'rgba(26,110,255,0.25)',

  // Status
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

  // Text
  textPrimary: '#1A1D24',
  textSecondary: '#5B6270',
  textMuted: '#9AA1AC',
  textMono: '#1A1D24',

  // SOS
  sos: '#E0263F',
  sosBorder: '#E0263F',
  sosBg: 'rgba(224,38,63,0.04)',
};

export const FONTS = {
  mono: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  sans: Platform.OS === 'ios' ? 'System' : 'Roboto',
};