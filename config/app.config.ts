/**
 * Centralized app identity.
 *
 * THIS IS THE ONLY PLACE these values live in the codebase.
 * To rename the app or change the bundle ID, edit this file and only this file.
 * Everything else in the project — package.json, app.config.ts (Expo), iOS Info.plist,
 * deep link scheme, push sender name, etc. — reads from here.
 *
 * In Phase 1 we wire this into:
 *   - app.config.ts (Expo): consumes APP_NAME, BUNDLE_ID, SCHEME
 *   - Info.plist (iOS): bundle display name comes from APP_NAME
 *   - package.json: name field generated from this
 *   - Deep link router: SCHEME
 *   - Email templates / push notifications: APP_NAME
 *   - Sentry / PostHog initialization: APP_NAME
 */

export const AppConfig = {
  /** Human-readable app name shown to users (App Store listing, home screen, headers). */
  APP_NAME: 'Hangout Planner',

  /** Short name (max 12 chars) for tight UI like the iOS home screen icon label. */
  APP_SHORT_NAME: 'Hangouts',

  /** One-line tagline used in onboarding, App Store subtitle, etc. */
  TAGLINE: 'Plans with friends, made easy.',

  /**
   * iOS bundle identifier. Reverse-DNS format.
   * Apple lets you change this up until first App Store submission. After that, it's permanent.
   */
  BUNDLE_ID: 'com.hangoutplanner.app',

  /** Android package — used when we add Android in v2. Must mirror BUNDLE_ID style. */
  ANDROID_PACKAGE: 'com.hangoutplanner.app',

  /**
   * Custom URL scheme for deep linking.
   * Used in: hangoutplanner://hangout/abc123
   * Universal links: https://hangoutplanner.app/hangout/abc123
   */
  SCHEME: 'hangoutplanner',
  UNIVERSAL_LINK_HOST: 'hangoutplanner.app',

  /** Support contact for App Store listing and in-app "Contact us". */
  SUPPORT_EMAIL: 'support@hangoutplanner.app', // change before launch
  SECURITY_EMAIL: 'security@hangoutplanner.app',

  /** Legal — placeholder URLs until we publish the real docs (before TestFlight public). */
  TERMS_URL: 'https://hangoutplanner.app/terms',
  PRIVACY_URL: 'https://hangoutplanner.app/privacy',

  /**
   * Apple Developer Team ID — fill this in once you've enrolled in the Developer Program.
   * Required for EAS Build and App Store Connect.
   */
  APPLE_TEAM_ID: '', // e.g., 'ABCDE12345'
} as const;

export type AppConfigType = typeof AppConfig;
