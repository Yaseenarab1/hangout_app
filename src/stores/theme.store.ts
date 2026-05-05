import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * User's theme preference.
 * - 'system' = follow iOS appearance (default)
 * - 'light'  = force light
 * - 'dark'   = force dark
 *
 * Persisted in AsyncStorage so it survives restarts.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeStore = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: 'theme-preference',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
