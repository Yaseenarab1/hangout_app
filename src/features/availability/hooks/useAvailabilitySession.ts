import { useQuery } from '@tanstack/react-query';
import { getHangoutSession, getSession } from '../services/availability.service';

export const availabilityKeys = {
  hangout: (hangoutId: string) => ['availability', 'hangout', hangoutId] as const,
  session: (sessionId: string) => ['availability', 'session', sessionId] as const,
};

export function useHangoutSession(hangoutId: string | undefined) {
  return useQuery({
    queryKey: availabilityKeys.hangout(hangoutId ?? ''),
    queryFn: () => getHangoutSession(hangoutId!),
    enabled: !!hangoutId,
    staleTime: 30 * 1000,
  });
}

export function useSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: availabilityKeys.session(sessionId ?? ''),
    queryFn: () => getSession(sessionId!),
    enabled: !!sessionId,
    staleTime: 20 * 1000,
  });
}
