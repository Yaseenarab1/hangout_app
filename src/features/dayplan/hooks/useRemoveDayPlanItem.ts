import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { removeDayPlanItem } from '../services/dayplan.service';
import { dayPlanKeys } from './useDayPlans';
import type { DayPlanWithItems } from '../types';

export function useRemoveDayPlanItem(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => removeDayPlanItem(itemId),
    onMutate: async (itemId) => {
      const key = dayPlanKeys.detail(planId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayPlanWithItems>(key);
      if (prev) {
        qc.setQueryData<DayPlanWithItems>(key, {
          ...prev,
          items: prev.items
            .filter((i) => i.id !== itemId)
            .map((i, idx) => ({ ...i, position: idx })),
        });
      }
      return { prev };
    },
    onError: (error, _itemId, context) => {
      if (context?.prev) {
        qc.setQueryData(dayPlanKeys.detail(planId), context.prev);
      }
      logError(error, { where: 'removeDayPlanItem' });
      toast.error('Could not remove stop. Try again.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: dayPlanKeys.detail(planId) });
    },
  });
}
