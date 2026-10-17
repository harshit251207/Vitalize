import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1D1D1F',
    background: '#FBFDFB',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EDF6EF',
    textSecondary: '#858585',
    primary: '#0A9F79',
    primaryLight: '#E5F5EF',
    border: '#F0F0EE',
    cardShadow: 'rgba(20, 24, 22, 0.06)',
    // Vitals Specific Colors
    bp: '#EF4444',
    sugar: '#F59E0B',
    heartRate: '#EC4899',
    weight: '#8B5CF6',
    success: '#168B63',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
  dark: {
    text: '#1D1D1F',
    background: '#FBFDFB',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EDF6EF',
    textSecondary: '#858585',
    primary: '#0A9F79',
    primaryLight: '#E5F5EF',
    border: '#F0F0EE',
    cardShadow: 'rgba(0, 0, 0, 0.3)',
    // Vitals Specific Colors
    bp: '#F87171',
    sugar: '#FBBF24',
    heartRate: '#F472B6',
    weight: '#A78BFA',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'Avenir Next',
    serif: 'Georgia',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'Georgia, "Times New Roman", serif',
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
