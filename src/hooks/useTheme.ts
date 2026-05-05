import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, type Theme } from '@/design/theme';
import { useThemeStore } from '@/stores/theme.store';

/**
 * Returns the active Theme based on the user's stored preference + iOS appearance.
 *
 * Components should NEVER import lightTheme/darkTheme directly.
 * Always call useTheme() so they update when the user toggles or system changes.
 */
export function useTheme(): Theme {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const preference = useThemeStore((s) => s.preference);

  const effective: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  return effective === 'dark' ? darkTheme : lightTheme;
}
