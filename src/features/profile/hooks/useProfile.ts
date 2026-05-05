import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { QUERY_KEYS } from '@/services/supabase/tables';
import { friendlyErrorMessage, logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { ANALYTICS_EVENTS, track } from '@/services/analytics';
import {
  getMyProfile,
  getProfile,
  isUsernameAvailable,
  completeProfile,
  updateProfile,
  updateAvatar,
} from '../services/profile.service';
import type { CreateProfileInput, UpdateProfileInput } from '../schemas';

export function useMyProfile() {
  return useQuery({
    queryKey: QUERY_KEYS.myProfile,
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? QUERY_KEYS.profile(userId) : ['profile', 'noop'],
    queryFn: () => (userId ? getProfile(userId) : Promise.resolve(null)),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Debounced username availability check. Returns:
 *   - data: boolean | undefined  (true = available)
 *   - isFetching, isLoading
 *   - debouncedUsername (the value actually queried)
 */
export function useUsernameAvailability(username: string, enabled = true) {
  const debounced = useDebounce(username.trim().toLowerCase(), 350);

  const query = useQuery({
    queryKey: QUERY_KEYS.usernameAvailable(debounced),
    queryFn: () => isUsernameAvailable(debounced),
    enabled: enabled && debounced.length >= 3,
    staleTime: 30 * 1000,
  });

  return {
    ...query,
    debouncedUsername: debounced,
  };
}

export function useCompleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProfileInput) => completeProfile(input),
    onSuccess: (profile) => {
      qc.setQueryData(QUERY_KEYS.myProfile, profile);
      qc.setQueryData(QUERY_KEYS.profile(profile.id), profile);
      track(ANALYTICS_EVENTS.profileCreated);
      toast.success('Profile created!');
    },
    onError: (error) => {
      logError(error, { where: 'completeProfile' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: (profile) => {
      qc.setQueryData(QUERY_KEYS.myProfile, profile);
      qc.setQueryData(QUERY_KEYS.profile(profile.id), profile);
      track(ANALYTICS_EVENTS.profileUpdated);
      toast.success('Profile updated.');
    },
    onError: (error) => {
      logError(error, { where: 'updateProfile' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useUpdateAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (localUri: string) => updateAvatar(localUri),
    onSuccess: (publicUrl) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.myProfile });
      track(ANALYTICS_EVENTS.avatarUploaded);
      if (publicUrl) toast.success('Avatar updated.');
    },
    onError: (error) => {
      logError(error, { where: 'updateAvatar' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}
