import { useQuery } from '@tanstack/react-query';
import { getTimePollByHangout, getOpenTimePollsForUser } from '../services/timepoll.service';

export const timePollKeys = {
  all: ['timepolls'] as const,
  byHangout: (hangoutId: string) => ['timepolls', 'byHangout', hangoutId] as const,
  openForUser: () => ['timepolls', 'openForUser'] as const,
};

export function useTimePoll(hangoutId: string | undefined) {
  return useQuery({
    queryKey: hangoutId ? timePollKeys.byHangout(hangoutId) : ['timepolls', 'noop'],
    queryFn: () => (hangoutId ? getTimePollByHangout(hangoutId) : Promise.resolve(null)),
    enabled: Boolean(hangoutId),
    staleTime: 10 * 1000,
  });
}

export function useOpenTimePolls() {
  return useQuery({
    queryKey: timePollKeys.openForUser(),
    queryFn: getOpenTimePollsForUser,
    staleTime: 30 * 1000,
  });
}
