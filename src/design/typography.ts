/**
 * Typography tokens.
 *
 * iOS uses SF Pro (system, free, no licensing). On iOS we get this for free
 * by setting fontFamily to undefined or 'System'.
 *
 * The scale is 9 steps; that's enough variety without becoming a typography zoo.
 * Components must pick from these — never `fontSize: 17`.
 */
import type { TextStyle } from 'react-native';

export const fontFamily = {
  // System maps to SF Pro on iOS, Roboto on Android (until we add Inter for Android).
  body: undefined as string | undefined,
  // Reserved for future custom font (e.g. for numeric displays). Unused in v1.
  display: undefined as string | undefined,
  // Monospace for code snippets in About screen, etc.
  mono: 'Menlo',
} as const;

type TypeStyle = Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing'>;

export const typography = {
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  bodySmallMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  tiny: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
} satisfies Record<string, TypeStyle>;

export type TypographyKey = keyof typeof typography;
