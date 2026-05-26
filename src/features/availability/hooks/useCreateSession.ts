import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSession } from '../services/availability.service';
import { availabilityKeys } from './useAvailabilitySession';
import type { CreateSessionInput } from '../types';

export function useCreateSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSessionInput) => createSession(input),
    onSuccess: (session) => {
      if (session.hangout_id) {
        qc.invalidateQueries({ queryKey: availabilityKeys.hangout(session.hangout_id) });
      }
    },
  });
}
