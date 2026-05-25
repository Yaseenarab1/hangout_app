import { useQuery } from '@tanstack/react-query';
import { getDayPlan } from '../services/dayplan.service';
import { dayPlanKeys } from './useDayPlans';

export function useDayPlan(planId: string | undefined) {
  return useQuery({
    queryKey: planId ? dayPlanKeys.detail(planId) : ['day-plan', 'noop'],
    queryFn: () => (planId ? getDayPlan(planId) : Promise.resolve(null)),
    enabled: Boolean(planId),
    staleTime: 15 * 1000,
  });
}
