import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { reorderDayPlanItems } from '../services/dayplan.service';
import { dayPlanKeys } from './useDayPlans';
import type { DayPlanWithItems } from '../types';

interface ReorderInput {
  planId: string;
  orderedIds: string[];
}

export function useReorderDayPlanItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReorderInput) =>
      reorderDayPlanItems(input.planId, input.orderedIds),
    onMutate: async (input) => {
      const key = dayPlanKeys.detail(input.planId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayPlanWithItems>(key);
      if (prev) {
        const itemMap = new Map(prev.items.map((i) => [i.id, i]));
        const reordered = input.orderedIds
          .map((id, idx) => {
            const item = itemMap.get(id);
            return item ? { ...item, position: idx } : null;
          })
          .filter((i): i is NonNullable<typeof i> => i !== null);
        qc.setQueryData<DayPlanWithItems>(key, { ...prev, items: reordered });
      }
      return { prev };
    },
    onError: (error, input, context) => {
      if (context?.prev) {
        qc.setQueryData(dayPlanKeys.detail(input.planId), context.prev);
      }
      logError(error, { where: 'reorderDayPlanItems' });
      toast.error('Could not reorder stops. Try again.');
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: dayPlanKeys.detail(input.planId) });
    },
  });
}
