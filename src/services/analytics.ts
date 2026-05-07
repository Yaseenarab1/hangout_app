import PostHog from 'posthog-react-native';
import { env } from '@/config/env';

/**
 * Analytics events.
 *
 * Add new events HERE so we have a typed registry — no rogue strings sprinkled
 * through the codebase.
 */
export const ANALYTICS_EVENTS = {
  // Auth
  signupStarted: 'signup_started',
  signupCompleted: 'signup_completed',
  signinSucceeded: 'signin_succeeded',
  signoutCompleted: 'signout_completed',
  appleSigninUsed: 'apple_signin_used',
  passwordResetRequested: 'password_reset_requested',

  // Profile
  profileCreated: 'profile_created',
  profileUpdated: 'profile_updated',
  avatarUploaded: 'avatar_uploaded',

  // Friends
  friendRequestSent: 'friend_request_sent',
  friendRequestAccepted: 'friend_request_accepted',
  friendRemoved: 'friend_removed',
  userBlocked: 'user_blocked',
  userUnblocked: 'user_unblocked',
} as const;

export type AnalyticsEvent =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

let posthogClient: PostHog | null = null;

export async function initAnalytics(): Promise<void> {
  if (!env.posthogKey || env.isDev) return;
  posthogClient = new PostHog(env.posthogKey, { host: env.posthogHost });
  // PostHog 3.x auto-flushes; nothing else to do.
}

export function track(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean | null>,
): void {
  if (env.isDev) {
    // eslint-disable-next-line no-console
    console.log('[analytics]', event, properties);
    return;
  }
  posthogClient?.capture(event, properties);
}

export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
  if (env.isDev) return;
  posthogClient?.identify(userId, properties as Record<string, string>);
}

export function resetAnalytics(): void {
  if (env.isDev) return;
  posthogClient?.reset();
}
