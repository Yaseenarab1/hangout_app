import { useQuery } from '@tanstack/react-query';
import { getDayPlans } from '../services/dayplan.service';

export const dayPlanKeys = {
  all: ['day-plans'] as const,
  byHangout: (hangoutId: string) => ['day-plans', hangoutId] as const,
  detail: (planId: string) => ['day-plan', planId] as const,
};

export function useDayPlans(hangoutId: string | undefined) {
  return useQuery({
    queryKey: hangoutId ? dayPlanKeys.byHangout(hangoutId) : ['day-plans', 'noop'],
    queryFn: () => (hangoutId ? getDayPlans(hangoutId) : Promise.resolve([])),
    enabled: Boolean(hangoutId),
    staleTime: 30 * 1000,
    retry: 1,
  });
}
