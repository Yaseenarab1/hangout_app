import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { env } from '@/config/env';
import type { Database } from './types.gen';

/**
 * The single Supabase client instance for the entire app.
 *
 * Token storage:
 *   - On iOS, refresh tokens go in the Keychain (via expo-secure-store).
 *     Keychain has a per-item size limit (~2 KB) which is plenty for tokens
 *     but not for large session metadata.
 *   - We use a hybrid adapter: refresh token in Keychain, the rest in AsyncStorage.
 *
 * Realtime:
 *   - We DO NOT enable realtime on this client by default. Realtime is
 *     opt-in per-channel in features that need it (chat, votes, locations).
 */

const REFRESH_TOKEN_KEY = 'sb-refresh-token';

const ExpoSecureStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);

    // Store the refresh token in Keychain for security; everything else in AsyncStorage.
    if (key.endsWith('-refresh-token') || key === REFRESH_TOKEN_KEY) {
      return SecureStore.getItemAsync(key);
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);

    if (key.endsWith('-refresh-token') || key === REFRESH_TOKEN_KEY) {
      return SecureStore.setItemAsync(key, value);
    }
    return AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.removeItem(key);

    if (key.endsWith('-refresh-token') || key === REFRESH_TOKEN_KEY) {
      return SecureStore.deleteItemAsync(key);
    }
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN doesn't have URLs the way web does
  },
});
