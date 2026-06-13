import * as Sentry from 'sentry-expo';
import { env } from '@/config/env';

/**
 * Centralized error handling.
 *
 * Two principles:
 *   1. NEVER show raw error messages to users. Show a friendly message and log the real one.
 *   2. ALWAYS log to Sentry in non-dev builds, with breadcrumbs for context.
 */

let initialized = false;

export function initErrorTracking(): void {
  if (initialized) return;
  if (!env.sentryDsn || env.isDev) {
    initialized = true;
    return;
  }
  Sentry.init({
    dsn: env.sentryDsn,
    enableInExpoDevelopment: false,
    debug: false,
    environment: env.appEnv,
    tracesSampleRate: env.isProd ? 0.2 : 1.0,
  });
  initialized = true;
}

export function logError(error: unknown, context?: Record<string, unknown>): void {
  if (env.isDev) {
    console.error('[error]', error, context);
    return;
  }
  Sentry.Native.captureException(error, { extra: context });
}

export function logWarning(message: string, context?: Record<string, unknown>): void {
  if (env.isDev) {
    console.warn('[warn]', message, context);
    return;
  }
  Sentry.Native.captureMessage(message, { level: 'warning', extra: context });
}

export function setUserContext(user: { id: string; username?: string } | null): void {
  if (env.isDev) return;
  if (!user) {
    Sentry.Native.setUser(null);
    return;
  }
  // We don't send email or full name to Sentry — just the ID.
  // (See docs/05-security-and-privacy.md §13.)
  Sentry.Native.setUser({ id: user.id, username: user.username });
}

/**
 * Convert a Supabase / network error into a user-friendly message.
 * Always log the real error before calling this so we can debug.
 */
export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      return "Can't reach the server. Check your connection and try again.";
    }
    if (message.includes('email') && message.includes('already')) {
      return 'That email is already registered. Try signing in instead.';
    }
    if (message.includes('invalid') && message.includes('credentials')) {
      return "That email and password don't match.";
    }
    if (message.includes('rate limit') || message.includes('too many')) {
      return 'Too many attempts. Wait a minute and try again.';
    }
    if (
      message.includes('row-level security') ||
      message.includes('rls') ||
      message.includes('policy')
    ) {
      // RLS errors are intentionally vague — don't leak existence.
      return "You don't have permission to do that.";
    }
  }
  return 'Something went wrong. Please try again.';
}
