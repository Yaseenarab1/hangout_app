import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertMyAvailability } from '../services/availability.service';
import { availabilityKeys } from './useAvailabilitySession';
import type { SessionWithResponses } from '../types';

export function useUpdateAvailability(
  sessionId: string,
  userId: string,
  hangoutId?: string | null,
) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (available: string[]) => upsertMyAvailability(sessionId, available),
    onMutate: async (available) => {
      const key = availabilityKeys.session(sessionId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SessionWithResponses>(key);

      if (prev && userId) {
        const responses = prev.responses.map((r) =>
          r.user_id === userId ? { ...r, available } : r,
        );
        if (!prev.responses.find((r) => r.user_id === userId)) {
          responses.push({
            id: 'optimistic',
            session_id: sessionId,
            user_id: userId,
            guest_name: null,
            available,
          });
        }
        qc.setQueryData<SessionWithResponses>(key, { ...prev, responses });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(availabilityKeys.session(sessionId), ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: availabilityKeys.session(sessionId) });
      if (hangoutId) {
        qc.invalidateQueries({ queryKey: availabilityKeys.hangout(hangoutId) });
      }
    },
  });
}
