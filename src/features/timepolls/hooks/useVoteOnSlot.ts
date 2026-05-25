import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { voteOnSlot } from '../services/timepoll.service';
import { timePollKeys } from './useTimePoll';
import type { TimePollWithSlots, VoteOnSlotInput } from '../types';

export function useVoteOnSlot(hangoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, response }: VoteOnSlotInput) => voteOnSlot(slotId, response),
    onMutate: async ({ slotId, response, userId }) => {
      const key = timePollKeys.byHangout(hangoutId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TimePollWithSlots>(key);
      if (!prev) return { prev };

      const updated: TimePollWithSlots = {
        ...prev,
        slots: prev.slots.map((slot) => {
          if (slot.id !== slotId) return slot;
          const prevResponse = slot.myResponse;
          let { yesCount, maybeCount, noCount } = slot;
          if (prevResponse === 'yes') yesCount = Math.max(0, yesCount - 1);
          if (prevResponse === 'maybe') maybeCount = Math.max(0, maybeCount - 1);
          if (prevResponse === 'no') noCount = Math.max(0, noCount - 1);
          if (response === 'yes') yesCount += 1;
          if (response === 'maybe') maybeCount += 1;
          if (response === 'no') noCount += 1;
          const filtered = slot.responses.filter((r) => r.user_id !== userId);
          return {
            ...slot,
            myResponse: response,
            yesCount,
            maybeCount,
            noCount,
            responses: [
              ...filtered,
              {
                slot_id: slotId,
                user_id: userId,
                response,
                created_at: new Date().toISOString(),
              },
            ],
          };
        }),
      };
      qc.setQueryData(key, updated);
      return { prev };
    },
    onError: (error, _vars, context) => {
      const key = timePollKeys.byHangout(hangoutId);
      if (context?.prev) qc.setQueryData(key, context.prev);
      logError(error, { where: 'voteOnSlot' });
      toast.error('Could not save vote. Try again.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: timePollKeys.byHangout(hangoutId) });
    },
  });
}
