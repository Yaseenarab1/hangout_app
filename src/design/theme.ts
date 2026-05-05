import {
  lightColors,
  darkColors,
  spacing,
  radii,
  elevations,
  motion,
  type ColorTokens,
} from './tokens';
import { typography, fontFamily } from './typography';

/**
 * A complete theme object. Components consume this via `useTheme()`.
 *
 * Both `light` and `dark` themes have the same shape; the colors differ.
 * That means a component can use `theme.colors.text.primary` and it works
 * automatically in both modes.
 */
export type Theme = {
  mode: 'light' | 'dark';
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  elevations: typeof elevations;
  motion: typeof motion;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
};

export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  spacing,
  radii,
  elevations,
  motion,
  typography,
  fontFamily,
};

export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  spacing,
  radii,
  elevations,
  motion,
  typography,
  fontFamily,
};

// Convenience for places that don't have a hook (e.g. native module config).
export const themes = { light: lightTheme, dark: darkTheme } as const;
