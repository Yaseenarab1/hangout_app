import { z } from 'zod';

/**
 * Validated environment configuration.
 *
 * We parse process.env once at app startup. If a required variable is missing,
 * we fail loudly with a clear error message — better than mysterious nulls
 * three layers deep in a network call.
 *
 * `EXPO_PUBLIC_*` variables are bundled into the client and are safe to be
 * "public" only because they don't contain secrets — the Supabase anon key
 * is paired with RLS, the Sentry DSN is designed for client-side use, etc.
 */

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'SUPABASE_ANON_KEY looks too short'),

  EXPO_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  EXPO_PUBLIC_POSTHOG_KEY: z.string().optional(),
  EXPO_PUBLIC_POSTHOG_HOST: z.string().url().default('https://us.posthog.com'),

  EXPO_PUBLIC_ENV: z.enum(['development', 'preview', 'production']).default('development'),
});

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  EXPO_PUBLIC_POSTHOG_KEY: process.env.EXPO_PUBLIC_POSTHOG_KEY,
  EXPO_PUBLIC_POSTHOG_HOST: process.env.EXPO_PUBLIC_POSTHOG_HOST,
  EXPO_PUBLIC_ENV: process.env.EXPO_PUBLIC_ENV,
});

if (!parsed.success) {
  // In production builds, Sentry isn't initialized yet, so we just throw.
  // Show the actual missing fields for fast debugging.
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(
    `Environment variable validation failed.\n\n${issues}\n\nDid you copy .env.example to .env.local and fill it in?`,
  );
}

export const env = {
  supabaseUrl: parsed.data.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: parsed.data.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  sentryDsn: parsed.data.EXPO_PUBLIC_SENTRY_DSN,
  posthogKey: parsed.data.EXPO_PUBLIC_POSTHOG_KEY,
  posthogHost: parsed.data.EXPO_PUBLIC_POSTHOG_HOST,
  appEnv: parsed.data.EXPO_PUBLIC_ENV,
  isDev: parsed.data.EXPO_PUBLIC_ENV === 'development',
  isProd: parsed.data.EXPO_PUBLIC_ENV === 'production',
} as const;

export type Env = typeof env;
