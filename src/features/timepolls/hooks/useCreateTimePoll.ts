import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { createTimePoll } from '../services/timepoll.service';
import { timePollKeys } from './useTimePoll';
import type { CreateTimePollInput } from '../types';

export function useCreateTimePoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTimePollInput) => createTimePoll(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: timePollKeys.byHangout(input.hangoutId) });
      qc.invalidateQueries({ queryKey: timePollKeys.openForUser() });
      toast.success('Poll created!');
    },
    onError: (error) => {
      logError(error, { where: 'createTimePoll' });
      toast.error('Could not create poll. Try again.');
    },
  });
}
