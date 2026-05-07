import { ExpoConfig, ConfigContext } from 'expo/config';

// Inline the config here because Expo evaluates this file with plain Node,
// which can't resolve TypeScript imports without a build step.
// Keep this in sync with config/app.config.ts.
const AppConfig = {
  APP_NAME: 'Hangout Planner',
  APP_SHORT_NAME: 'Hangouts',
  TAGLINE: 'Plans with friends, made easy.',
  BUNDLE_ID: 'com.hangoutplanner.app',
  ANDROID_PACKAGE: 'com.hangoutplanner.app',
  SCHEME: 'hangoutplanner',
  UNIVERSAL_LINK_HOST: 'hangoutplanner.app',
  SUPPORT_EMAIL: 'support@hangoutplanner.app',
  SECURITY_EMAIL: 'security@hangoutplanner.app',
  TERMS_URL: 'https://hangoutplanner.app/terms',
  PRIVACY_URL: 'https://hangoutplanner.app/privacy',
  APPLE_TEAM_ID: '',
} as const;

/**
 * Expo's app config. Expo CLI loads this file at startup.
 *
 * Everything app-identity-related is read from `config/app.config.ts` so we have a
 * single source of truth. To rename the app, edit that one file.
 *
 * Environment-dependent values (project ref, IDs) come from environment variables.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: AppConfig.APP_NAME,
  slug: 'hangout-planner',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: AppConfig.SCHEME,
  userInterfaceStyle: 'automatic', // Respect system light/dark
  newArchEnabled: true, // RN's new architecture is the default in SDK 52+
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#FAFAF9',
  },

  ios: {
    bundleIdentifier: AppConfig.BUNDLE_ID,
    supportsTablet: false,
    config: {
      usesNonExemptEncryption: false, // We use only TLS — no custom crypto.
    },
    infoPlist: {
      NSCameraUsageDescription:
        `${AppConfig.APP_NAME} uses your camera to capture photos for hangout albums and to scan receipts when splitting bills.`,
      NSPhotoLibraryUsageDescription:
        `${AppConfig.APP_NAME} accesses your photo library so you can post photos and add them to hangout albums.`,
      NSPhotoLibraryAddUsageDescription:
        `${AppConfig.APP_NAME} saves photos you choose to your photo library.`,
      NSLocationWhenInUseUsageDescription:
        `${AppConfig.APP_NAME} uses your location only when you choose to share it with friends in a hangout.`,
      NSLocationAlwaysAndWhenInUseUsageDescription:
        `${AppConfig.APP_NAME} can share your location with friends in the background during a hangout you're attending. You can stop at any time.`,
      NSContactsUsageDescription:
        `${AppConfig.APP_NAME} does not access your contacts. (Reserved for a future opt-in feature.)`,
      // Universal links
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: [AppConfig.SCHEME],
        },
      ],
    },
    associatedDomains: [`applinks:${AppConfig.UNIVERSAL_LINK_HOST}`],
  },

  android: {
    package: AppConfig.ANDROID_PACKAGE,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#8B5CF6',
    },
  },

  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#8B5CF6',
        sounds: [],
      },
    ],
    '@react-native-community/datetimepicker',
    'expo-apple-authentication',
    [
      'expo-image-picker',
      {
        photosPermission:
          `${AppConfig.APP_NAME} accesses your photo library so you can post photos and add them to hangout albums.`,
        cameraPermission:
          `${AppConfig.APP_NAME} uses your camera to capture photos for hangout albums and to scan receipts.`,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        backgroundColor: '#FAFAF9',
        dark: { backgroundColor: '#09090B' },
      },
    ],
    'sentry-expo',
  ],

  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID, // set in EAS dashboard, not committed
    },
    env: process.env.EXPO_PUBLIC_ENV ?? 'development',
  },

  experiments: {
    typedRoutes: true, // Strongly-typed routes for Expo Router
  },

});
