import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { closeTimePoll } from '../services/timepoll.service';
import { timePollKeys } from './useTimePoll';

export function useCloseTimePoll(hangoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pollId, winningSlotId }: { pollId: string; winningSlotId?: string }) =>
      closeTimePoll(pollId, winningSlotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timePollKeys.byHangout(hangoutId) });
      qc.invalidateQueries({ queryKey: timePollKeys.openForUser() });
      toast.success('Poll closed.');
    },
    onError: (error) => {
      logError(error, { where: 'closeTimePoll' });
      toast.error('Could not close poll. Try again.');
    },
  });
}
