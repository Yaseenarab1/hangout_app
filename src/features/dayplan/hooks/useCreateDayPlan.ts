import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { createDayPlan } from '../services/dayplan.service';
import { dayPlanKeys } from './useDayPlans';
import type { CreateDayPlanInput } from '../types';

export function useCreateDayPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDayPlanInput) => createDayPlan(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: dayPlanKeys.byHangout(input.hangoutId) });
    },
    onError: (error) => {
      logError(error, { where: 'createDayPlan' });
      toast.error('Could not create day plan. Try again.');
    },
  });
}
