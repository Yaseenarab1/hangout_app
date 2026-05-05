/**
 * Centralized app identity (mirror of /config/app.config.ts).
 *
 * The same values live in two places by design:
 *   - /config/app.config.ts            (used by Expo's app.config.ts at the root)
 *   - /src/config/app.config.ts        (used by app code via @/config/app.config)
 *
 * They MUST stay in sync. When you change one, change the other.
 */
export const AppConfig = {
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

export type AppConfigType = typeof AppConfig;
