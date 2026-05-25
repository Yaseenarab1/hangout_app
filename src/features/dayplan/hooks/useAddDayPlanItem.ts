import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { addDayPlanItem } from '../services/dayplan.service';
import { dayPlanKeys } from './useDayPlans';
import type { AddDayPlanItemInput } from '../types';

export function useAddDayPlanItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddDayPlanItemInput) => addDayPlanItem(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: dayPlanKeys.detail(input.planId) });
    },
    onError: (error) => {
      logError(error, { where: 'addDayPlanItem' });
      toast.error('Could not add stop. Try again.');
    },
  });
}
