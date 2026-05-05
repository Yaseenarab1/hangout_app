import { supabase } from '@/services/supabase/client';
import { ANALYTICS_EVENTS, identifyUser, resetAnalytics, track } from '@/services/analytics';
import { setUserContext, logError } from '@/services/errors';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { Session } from '@supabase/supabase-js';
import type { SignInInput, SignUpInput, VerifyEmailInput } from '../schemas';

/**
 * All auth operations route through this module. Components NEVER call
 * supabase.auth directly — they go through hooks that go through here.
 */

export async function signInWithEmail(input: SignInInput): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error || !data.session) throw error ?? new Error('Sign in failed');

  track(ANALYTICS_EVENTS.signinSucceeded);
  identifyUser(data.user.id);
  setUserContext({ id: data.user.id });
  return data.session;
}

export async function signUpWithEmail(input: SignUpInput): Promise<{
  needsVerification: boolean;
  session: Session | null;
}> {
  track(ANALYTICS_EVENTS.signupStarted);

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // Supabase will email a verification code to this address.
      // For dev, you can disable verification in Supabase Auth settings.
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error('Sign up returned no user');

  // If email confirmation is enabled, session is null until verified.
  return {
    needsVerification: !data.session,
    session: data.session,
  };
}

export async function verifyEmail(input: VerifyEmailInput): Promise<Session> {
  const { data, error } = await supabase.auth.verifyOtp({
    email: input.email,
    token: input.token,
    type: 'email',
  });

  if (error || !data.session) throw error ?? new Error('Verification failed');

  track(ANALYTICS_EVENTS.signupCompleted);
  identifyUser(data.user!.id);
  setUserContext({ id: data.user!.id });
  return data.session;
}

export async function signInWithApple(): Promise<Session> {
  // 1. Get the Apple identity credential.
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  // 2. Exchange it for a Supabase session.
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });

  if (error || !data.session) throw error ?? new Error('Apple sign-in failed');

  track(ANALYTICS_EVENTS.appleSigninUsed);
  identifyUser(data.user.id);
  setUserContext({ id: data.user.id });
  return data.session;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Supabase sends an email with a link/code; for v1 we ask user to enter the code.
    // In Phase 5 we'll set up a deep link to a "set new password" screen.
  });
  if (error) throw error;
  track(ANALYTICS_EVENTS.passwordResetRequested);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    logError(error, { where: 'signOut' });
    throw error;
  }
  track(ANALYTICS_EVENTS.signoutCompleted);
  resetAnalytics();
  setUserContext(null);
}
/**
 * Whether Apple sign-in is available on this device. Always false on Android/web.
 */
export async function appleAuthAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
