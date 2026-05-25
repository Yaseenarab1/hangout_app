import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { updateDayPlan } from '../services/dayplan.service';
import { dayPlanKeys } from './useDayPlans';
import type { DayPlanWithItems } from '../types';

interface UpdateInput {
  planId: string;
  title?: string;
  planDate?: string | null;
}

export function useUpdateDayPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateInput) =>
      updateDayPlan(input.planId, { title: input.title, planDate: input.planDate }),
    onMutate: async (input) => {
      const key = dayPlanKeys.detail(input.planId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayPlanWithItems>(key);
      if (prev) {
        qc.setQueryData<DayPlanWithItems>(key, {
          ...prev,
          title: input.title !== undefined ? input.title : prev.title,
          plan_date:
            input.planDate !== undefined ? input.planDate : prev.plan_date,
          updated_at: new Date().toISOString(),
        });
      }
      return { prev };
    },
    onError: (error, input, context) => {
      if (context?.prev) {
        qc.setQueryData(dayPlanKeys.detail(input.planId), context.prev);
      }
      logError(error, { where: 'updateDayPlan' });
      toast.error('Could not update plan. Try again.');
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: dayPlanKeys.detail(input.planId) });
    },
  });
}
