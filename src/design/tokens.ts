/**
 * Design tokens.
 *
 * THE source of truth for colors, spacing, radii, and elevation in the app.
 * All components MUST consume these via `useTheme()`. Hard-coded hex values
 * elsewhere are a code-review reject.
 *
 * Reference: docs/03-design-system.md
 */

// -----------------------------------------------------------------------------
// Brand palette
// -----------------------------------------------------------------------------
const brand = {
  50: '#F5F3FF',
  100: '#EDE9FE',
  200: '#DDD6FE',
  300: '#C4B5FD',
  400: '#A78BFA',
  500: '#8B5CF6', // primary
  600: '#7C3AED', // hover/pressed
  700: '#6D28D9',
  800: '#5B21B6',
  900: '#4C1D95',
} as const;

// -----------------------------------------------------------------------------
// Light theme
// -----------------------------------------------------------------------------
export const lightColors = {
  bg: {
    canvas: '#FAFAF9',
    surface: '#FFFFFF',
    subtle: '#F4F4F5',
    muted: '#E4E4E7',
  },
  border: {
    default: '#E4E4E7',
    strong: '#A1A1AA',
  },
  text: {
    primary: '#18181B',
    secondary: '#52525B',
    tertiary: '#71717A',
    inverse: '#FAFAFA',
  },
  accent: brand[500],
  accentHover: brand[600],
  accentSubtle: brand[50],
  accentText: brand[700],
  success: '#16A34A',
  successSubtle: '#DCFCE7',
  warning: '#D97706',
  warningSubtle: '#FEF3C7',
  danger: '#DC2626',
  dangerSubtle: '#FEE2E2',
  info: '#0284C7',
  infoSubtle: '#E0F2FE',
  // Overlay used behind modals/sheets
  overlay: 'rgba(0, 0, 0, 0.4)',
} as const;

// -----------------------------------------------------------------------------
// Dark theme
// -----------------------------------------------------------------------------
export const darkColors = {
  bg: {
    canvas: '#09090B',
    surface: '#18181B',
    subtle: '#27272A',
    muted: '#3F3F46',
  },
  border: {
    default: '#27272A',
    strong: '#52525B',
  },
  text: {
    primary: '#FAFAFA',
    secondary: '#A1A1AA',
    tertiary: '#71717A',
    inverse: '#18181B',
  },
  accent: brand[400], // lighter for dark contrast
  accentHover: brand[300],
  accentSubtle: '#2A1F4D',
  accentText: brand[300],
  success: '#22C55E',
  successSubtle: '#14532D',
  warning: '#F59E0B',
  warningSubtle: '#451A03',
  danger: '#EF4444',
  dangerSubtle: '#450A0A',
  info: '#38BDF8',
  infoSubtle: '#082F49',
  overlay: 'rgba(0, 0, 0, 0.7)',
} as const;

// Both color sets MUST have identical shapes — TS enforces this.
export type ColorTokens = typeof lightColors;

// -----------------------------------------------------------------------------
// Spacing — 4-point grid
// -----------------------------------------------------------------------------
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16, // default screen padding
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export type SpacingKey = keyof typeof spacing;

// -----------------------------------------------------------------------------
// Border radii
// -----------------------------------------------------------------------------
export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

// -----------------------------------------------------------------------------
// Elevation (shadows)
// In dark mode we use border outlines instead — see useTheme().
// -----------------------------------------------------------------------------
export const elevations = {
  e0: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  e1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  e2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  e3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  e4: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 8,
  },
} as const;

export type ElevationKey = keyof typeof elevations;

// -----------------------------------------------------------------------------
// Motion
// -----------------------------------------------------------------------------
export const motion = {
  duration: {
    fast: 150,
    base: 220,
    slow: 350,
  },
  easing: {
    // Reanimated 3 expects easing functions; we pass strings here and resolve in useTheme
    out: 'easeOut',
    in: 'easeIn',
    inOut: 'easeInOut',
  },
} as const;
