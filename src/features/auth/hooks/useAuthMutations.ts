import {
  signInWithEmail,
  signUpWithEmail,
  signInWithApple,
  verifyEmail,
  requestPasswordReset,
  signOut,
} from '../services/auth.service';
import type {
  SignInInput,
  SignUpInput,
  VerifyEmailInput,
} from '../schemas';
import { friendlyErrorMessage, logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Each mutation hook wraps a service call. The components call .mutate() and the
 * hook handles loading state and error toasts. The component just decides what
 * to do on success (e.g. navigate).
 */

export function useSignIn() {
  return useMutation({
    mutationFn: (input: SignInInput) => signInWithEmail(input),
    onError: (error) => {
      logError(error, { where: 'signIn' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: (input: SignUpInput) => signUpWithEmail(input),
    onError: (error) => {
      logError(error, { where: 'signUp' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useAppleSignIn() {
  return useMutation({
    mutationFn: () => signInWithApple(),
    onError: (error) => {
      // User canceling the Apple sheet throws — don't toast that.
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('canceled') || msg.includes('AuthRequestCanceled')) return;
      logError(error, { where: 'appleSignIn' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (input: VerifyEmailInput) => verifyEmail(input),
    onError: (error) => {
      logError(error, { where: 'verifyEmail' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => requestPasswordReset(email),
    onSuccess: () => {
      toast.success('Check your email for a reset link.');
    },
    onError: (error) => {
      logError(error, { where: 'passwordReset' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}
export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => signOut(),
    onSuccess: () => {
      // Clear ALL cached queries so the next user starts fresh
      qc.clear();
    },
    onError: (error) => {
      logError(error, { where: 'signOut' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}
