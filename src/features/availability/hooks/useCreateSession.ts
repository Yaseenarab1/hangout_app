import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { createSession } from '../services/availability.service';
import { supabase } from '@/services/supabase/client';
import { availabilityKeys } from './useAvailabilitySession';
import type { CreateSessionInput } from '../types';

export function useCreateSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSessionInput) => createSession(input),
    onSuccess: async (session) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        qc.invalidateQueries({ queryKey: ['availability_sessions', 'mine', user.id] });
      }
      if (session.hangout_id) {
        qc.invalidateQueries({ queryKey: availabilityKeys.hangout(session.hangout_id) });
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Try again.';
      Alert.alert('Could not create session', msg);
    },
  });
}
